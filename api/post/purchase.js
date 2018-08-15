"use strict"

const jwt = require('jsonwebtoken')
const { verifyToken } = require('@stormgle/jtoken-util')
const http = require('http')

/* sign token as delegated admin to get user info later*/
const serverSecret = process.env.DELIGATE_KEY_ADMIN_SERVER;
const token = jwt.sign(
  {uid: 'sg-purchase-server'},
  serverSecret,
  {
    expiresIn: "14 days"
  }
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
      req.user = data[0];
      const items = data.slice(1);
      req.items = items;
      next();
    }).catch(err => res.status(400).send())

  }
}

function final() {
  return function(req, res) {
    res.status(200).json({status: 'success'})
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

module.exports = [authen, getCart, prepareData, final]