const express = require('express');
const { body } = require('express-validator');
const authMiddleware = require('../middlewares/auth');
const {
  investmentSetup,
  personalDetails,
  bankSetup,
  startIdentityVerification,
  createCard
} = require('../controllers/personalController');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Investment account info
router.post('/investment-setup', [
  body('investmentType').notEmpty()
], investmentSetup);

// Personal details
router.post('/details', [
  body('fullName').notEmpty(),
  body('address').notEmpty(),
  body('state').notEmpty(),
  body('city').notEmpty(),
  body('zipcode').notEmpty(),
  body('SSN').notEmpty(),
  body('dateOfBirth').isISO8601()
], personalDetails);

// Bank account setup
router.post('/bank-setup', [
  body('accountName').notEmpty(),
  body('accountType').notEmpty(),
  body('routingNumber').notEmpty(),
  body('accountNumber').notEmpty()
], bankSetup);

// Identity Verification (Stripe Identity)
router.post('/identity/start', startIdentityVerification);

// Issue Stripe Debit Card
router.post('/card/create', [
  body('nameOnCard').notEmpty(),
  body('cardType').isIn(['personal', 'business']),
  body('deliveryAddress').notEmpty()
], createCard);

module.exports = router;