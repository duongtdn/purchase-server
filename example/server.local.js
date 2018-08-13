"use strict"

require('dotenv').config()

const db = require('database-test-helper')
const invoicedb = require('invoicedb-test-helper')

db.start().add({invoicedb}).init(() => {
  const app = require('./app.local')
  const PORT = process.env.PORT_LOCAL_PURCHASE || 3210;
  const httpServer = require('http').createServer(app);
  httpServer.listen(PORT)
  console.log(`\n# PURCHASE-SERVICES is running at http://localhost:${PORT}\n`);
});