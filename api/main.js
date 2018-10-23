"use strict"

const api = require('express-api-binder')

api.__helper = {}

api.helper = function(options) {
  api.__helper = options
}

const funcs = [
  'get/invoice/:number',
  'post/purchase'
]

funcs.forEach(func => {
  const { method, uri, includePath } = api.parseApi(func);
  api.createFunction(method, uri, require(`./${includePath}`), api.__helper)
})

module.exports = api;