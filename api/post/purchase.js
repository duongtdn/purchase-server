"use strict"

const jwt = require('jsonwebtoken')
const { verifyToken } = require('@stormgle/jtoken-util')
const https = require('https')

/* sign token as delegated admin to get user info later*/
const serverSecret = process.env.DELIGATE_KEY_ADMIN_SERVER;
const token = jwt.sign(
  {uid: 'sg-purchase-server'},
  serverSecret
);

const secret = process.env.AUTH_KEY_SGLEARN;
function authen() {
  return verifyToken(secret);
}

function getCart(db) {
  return function(req, res, next) {
    const cart = req.body.cart;
    if (cart && cart.items && cart.billTo) {
      req.cart = cart;
      next();
    } else {
      res.status(400).send();
    }
  }
}

function prepareData(db) {
  return function(req, res, next) {
    const _promises = [];
    const uid = req.user.uid;

    // store userid along with invoice
    if (!req.cart.billTo) {
      req.cart.billTo = {}
    }
    req.cart.billTo.uid = uid;

    /* get user information to retrieve promotion offer to user */
    _promises.push(_authGetUser(uid, token));

    /* get items information to check price and offer */
    req.cart.items.forEach(item => {
      if (item.type === 'course') {
        _promises.push(_getCourse(db, item.code))
      }
    })

    Promise.all(_promises).then( data => {

      const _user = JSON.parse(data[0]);
      if (_user && _user.user) {
        req.user = _user.user
      }
      
      const items = data.slice(1);
      req.items = items;

      next();

    }).catch(err => res.status(400).send())

  }
}

function checkCart() {
  return function(req, res, next) {
    const user = req.user;
    const cartItems = req.cart.items;
    const _check = cartItems.every(item => {
      const _item = _getItemDetail(item, req.items);
      _item.type = item.type; // for _calculateOfferPrice, need to know type to match with user special offer
      const _price = _calculateOfferPrice(_item, user)
      return _comparePrice(item.price, _price)
    })
    if (_check) {
      next()
    } else {
      err => res.status(400).send()
    }
  } 
}

/*
  -----------------------------------
  work halt. to be implemented later
  -----------------------------------
  currently, it does not check where user has enrolled a course yet.
  If user has enrolled a course, it will override the enroll record with new invoice and status (billing).
  
  Expected behaviors:
  If user purchase a bundle of courses, some course has been purchased and paid, then the new invoice must exclude
  these courses.
  If those course is not paid yet, then override enroll record with new invoice
  There must be an escape way to cancel old invoice, even by user or admin. 
  If a enroll is overrided, then the invoice associated with that enroll must be changed status to outdated.
  When user enroll, notify user that those invoice is outdated.

  Current Workaround:
  currently, bundle purchasing is not implemented yet
  therefore, just check whether course is enrolled. If yes, return 304
*/
function checkEnroll() {
  return function(req, res, next) {
    const uid = req.user.uid;
    db.enroll.getEnrollList({uid}, (err, data) => {
      if (err) {
        res.status(500).json({err:'Access Database failed! Cannot check Enroll List'})
      } else {
        const _enrolled = data;
        console.log(_enroll)
        const items = req.cart.items;
        items.forEach(item => {
          if (item.type === 'course' && _enrolled.some(e => e.courseId === item.code)) {
            res.status(304).json({err: `Course ${item.code} has been enrolled`})
            return
          }
        }) 
        next()
      }
    }) 
  }
}

function createInvoice(db) {
  return function(req, res, next) {
    const invoice = {
      ...req.cart,
      subTotal: _sumUpPrice(req.cart.items),
    }
    db.invoice.createInvoice(invoice, (err, data) => {
      if (err) {
        res.status(500).json({err:'Access Database failed! Cannot create Invoice'})
      } else {
        req.invoice = data;
        next()
      }
    })

  }
}

function processItem(db) {
  return function(req, res, next) {
    const items = req.cart.items;
    const user = req.user;
    const invoice = req.invoice;
    const _promises = [];

    items.forEach(item => {
      if (item.type === 'course') {
        _promises.push(_enroll(item, invoice, user, db.enroll));
        return
      }
    })

    Promise.all(_promises)
      .then( (values) => next() )
      .catch( (err) => res.status(500).send() )

  }
}

function sendEmail(db, helper) {
  return function(req, res, next) {
    if (helper && helper.sendEmail) {
      const invoice = req.invoice;
      const recipient = invoice.billTo.email;
      const customer = req.user.profile.firstName || 'Customer'
      helper.sendEmail({recipient, customer, invoice}, err => {
        next()
      })
    } else {
      next()
    }
  }
}

function final() {
  return function(req, res) {
    res.status(200).json({data: req.invoice})
  }
}

function _authGetUser(uid, token) {
  const options = {
    hostname: process.env.AUTH_HOST || 'localhost',
    port:  process.env.AUTH_PORT || 3100,
    method: 'GET',
    path:`/users/uid/${uid}`,
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  return new Promise((resolve, reject) => {

    const req = https.request(options, (res) => {
      let user = null;
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        user = chunk;
      });
      res.on('end', () => {
        resolve(user);
      });
    })

    req.on('error', (e) => {
      reject(e);
    });
  
    req.end();

  })

}

function _getCourse(db, courseId) {
  return new Promise((resolve, reject) => {
    db.course.getCourse({ courseId }, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

function _getItemDetail(item, items) {
  const _filtered = items.filter( _item => {
    return (_item[`${item.type}Id`] === item.code)
  })  
  return (_filtered.length > 0)? _filtered[0] : null;
}

function _calculateOfferPrice(item, user) {
  const price = {
    origin: item.price.value
  }

  let deduction = 0;
  if (item.promote.discount) {
    deduction += item.promote.discount;
  }
  if (user && 
      user.promote && 
      user.promote[item.type]  && user.promote[item.type][item[`${item.type}Id`]] ) {
    deduction += user.promote[item.type][item[`${item.type}Id`]];
  }

  const offer = price.origin - deduction;
  price.offer = (offer > 0) ? offer : 0;
  price.discount = Math.floor((deduction / price.origin) * 100)
  return price;
}

function _comparePrice(priceA, priceB) {
  return (priceA.origin === priceB.origin) && (priceA.offer === priceB.offer)
}

function _sumUpPrice(items) {
  let subTotal = 0;
  items.forEach( item => {
    if (item.price.offer) {
      subTotal += (item.price.offer * item.quantity);
    } else {
      subTotal += (item.price.origin * item.quantity);
    }
  })
  return subTotal;
}

function _enroll(item, invoice, user, db) {
  return new Promise((resolve, reject) => {
    const enroll = {
      uid: user.uid,
      courseId: item.code,
      invoice: invoice.number,
      status: invoice.status,   
      enrollAt: invoice.issueAt   
    }

    db.createEnroll(enroll, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(enroll)
      }
    })
  })
}

module.exports = [authen, getCart, prepareData, checkCart, checkEnroll, createInvoice, processItem, sendEmail, final]