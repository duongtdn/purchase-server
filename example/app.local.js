"use strict"

const api = require('../api/main')

const DatabaseAbstractor = require("database-abstractor")
const invoice = new DatabaseAbstractor();
const course = new DatabaseAbstractor();
const enroll = new DatabaseAbstractor();

const DB = {
  HOST: process.env.DB_HOST || 'http://localhost',
  PORT: process.env.DB_PORT || 3001
}

invoice.use(require('invoicedb-dynamodb-driver')({
  region : 'us-west-2', 
  endpoint : `${DB.HOST}:${DB.PORT}`
}))

course.use(require('coursedb-dynamodb-driver')({
  region : 'us-west-2', 
  endpoint : `${DB.HOST}:${DB.PORT}`
}))

enroll.use(require('enrolldb-dynamodb-driver')({
  region : 'us-west-2', 
  endpoint : `${DB.HOST}:${DB.PORT}`
}))

api.useDatabase({ invoice, course, enroll })

/* create express app from api */
const express = require('express')
const cors = require('cors')

const app = express();

app.use(cors());

app.use('/', api);

module.exports = app;