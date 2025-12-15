const express = require('express');
const { createLinkToken, exchangePublicToken, getTransactions, getAccounts, getTransactionSummary, getCardDetails, getReserves, initiateTransfer, quickTransfer, unlinkAccount, getTransfers } = require('../controllers/plaidController');
const auth = require('../middlewares/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Create link token
router.post('/create-link-token', createLinkToken);

// Exchange public token
router.post('/exchange-public-token', exchangePublicToken);

// Unlink bank account
router.post('/unlink', unlinkAccount);

// Get transactions
router.get('/transactions', getTransactions);

// Get accounts
router.get('/accounts', getAccounts);

// Get transaction summary
router.get('/transaction-summary', getTransactionSummary);

// Get connected card details
router.get('/card-details', getCardDetails);

// Get all reserves
router.get('/reserves', getReserves);

// Get user's transfer history
router.get('/transfers', getTransfers);

// Initiate a transfer
router.post('/transfer', initiateTransfer);

// Quick transfer to linked Plaid account
router.post('/quick-transfer', quickTransfer);

module.exports = router;