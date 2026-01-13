const express = require('express');
const { addCard, blockCard, changePin, requestCard, createInvoice, listInvoices, makePayment, getBillingHistory } = require('../controllers/cardController');
const auth = require('../middlewares/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get billing history
router.get('/billing-history', getBillingHistory);

// Add external card
router.post('/add', addCard);

// Block card
router.post('/block', blockCard);

// Change PIN
router.post('/change-pin', changePin);

// Request new card
router.post('/request', requestCard);

// Create invoice
router.post('/invoice', createInvoice);

// List invoices
router.get('/invoices', listInvoices);

// Make payment
router.post('/payment', makePayment);

module.exports = router;