"use strict"

const api = require('express-api-binder')

const funcs = [
  'get/invoice/:number',
  'post/purchase'
]

funcs.forEach(func => {
  const { method, uri, includePath } = api.parseApi(func);
  api.createFunction(method, uri, require(`./${includePath}`))
})

module.exports = api;