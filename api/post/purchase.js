"use strict"

const jwt = require('jsonwebtoken')
const { verifyToken } = require('@stormgle/jtoken-util')
const http = require('http')

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

function createInvoice(db) {
  return function(req, res, next) {
    const invoice = {
      ...req.cart,
      totalPrice: _sumUpPrice(req.cart.items),
    }
    db.invoice.createInvoice(invoice, (err, data) => {
      if (err) {
        res.status(400).send()
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

function final() {
  return function(req, res) {
    res.status(200).json({data: req.invoice})
  }
}

function _authGetUser(uid, token) {
  const options = {
    host: 'localhost',
    port: 3100,
    method: 'GET',
    path:`/users/uid/${uid}`,
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  return new Promise((resolve, reject) => {

    const req = http.request(options, (res) => {
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
  let totalPrice = 0;
  items.forEach( item => {
    if (item.price.offer) {
      totalPrice += (item.price.offer * item.quantity);
    } else {
      totalPrice += (item.price.origin * item.quantity);
    }
  })
  return totalPrice;
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

module.exports = [authen, getCart, prepareData, checkCart, createInvoice, processItem, final]