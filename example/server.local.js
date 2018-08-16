"use strict"

require('dotenv').config()

const db = require('database-test-helper')
const invoicedb = require('invoicedb-test-helper')
const enrolldb = require('enrolldb-test-helper')
const coursedb = require('coursedb-test-helper')

db.start().add({invoicedb, enrolldb, coursedb}).init(() => {
  const app = require('./app.local')
  const PORT = process.env.PORT_LOCAL_PURCHASE || 3210;
  const httpServer = require('http').createServer(app);
  httpServer.listen(PORT)
  console.log(`\n# PURCHASE-SERVICES is running at http://localhost:${PORT}\n`);
});