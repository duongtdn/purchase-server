"use strict"

const { verifyToken } = require('@stormgle/jtoken-util')

const secret = process.env.AUTH_KEY_SGLEARN;

/* sign token as delegated admin to get user info later*/


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
    
    next();
  }
}

function final() {
  return function(req, res) {
    res.status(200).json({status: 'success'})
  }
}

module.exports = [authen, getCart, getUserInfo, final]