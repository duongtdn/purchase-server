"use strict"

function authen() {

}

function getInvoice(db) {
  return function(req, res, next) {
    const invoiceNumber = req.params && req.params.number;
    db.invoice.getInvoice(invoiceNumber, (err, data) => {
      if (err) {
        res.status(400).send()
      } else {
        req.data = data;
        next();
      }
    })
  }
}

function serialize() {
  return function(req, res) {
   res.status(200).json({data: req.data})
  }
}

module.exports = [getInvoice, serialize]