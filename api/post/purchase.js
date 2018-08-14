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

function getUserInfo() {
  return function(req, res, next) {
    const uid = req.user.uid;
    // get user info from authentication service using deligated admin token
    _authGetUser(uid, token)
    next();
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
  
  const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
      console.log('No more data in response.');
    });
  })

  req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
  });

  // req.write('');
  req.end();

}

module.exports = [authen, getCart, getUserInfo, final]