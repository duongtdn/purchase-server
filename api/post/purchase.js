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
    if (cart) {
      req.cart = cart;
      next();
    } else {
      res.status(400).send();
    }
  }
}

function prepareData() {
  return function(req, res, next) {
    const uid = req.user.uid;
    // get user info from authentication service using deligated admin token
    _authGetUser(uid, token).then( user => {
      req.user = user;
      next();
    }).catch( error => res.status(400).send() )
  }
}

function final() {
  return function(req, res) {
    console.log(req.user)
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

module.exports = [authen, getCart, prepareData, final]