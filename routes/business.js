const express = require('express');
const { body } = require('express-validator');
const authMiddleware = require('../middlewares/auth');
const {
  investmentSetup,
  addressSetup,
  companyDetails,
  startIdentityVerification,
  createCard
} = require('../controllers/businessController');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Investment account info
router.post('/investment-setup', [
  body('investmentType').notEmpty()
], investmentSetup);

// Residence information
router.post('/address', [
  body('state').notEmpty(),
  body('city').notEmpty(),
  body('zipcode').notEmpty(),
  body('residentialAddress').notEmpty()
], addressSetup);

// Business details
router.post('/company-details', [
  body('businessType').notEmpty(),
  body('roleInBusiness').notEmpty(),
  body('ownershipPercentage').isNumeric(),
  body('businessRegisteredState').notEmpty(),
  body('businessAddress').notEmpty(),
  body('businessPhone').notEmpty(),
  body('EIN').notEmpty(),
  body('businessStartDate').isISO8601(),
  body('monthlyRevenue').isNumeric(),
  body('transferPurpose').notEmpty()
], companyDetails);

// Identity Verification (Stripe Identity)
router.post('/identity/start', startIdentityVerification);

// Create Stripe Issuing Business Debit Card
router.post('/card/create', [
  body('businessNameOnCard').notEmpty(),
  body('deliveryAddress').notEmpty()
], createCard);

module.exports = router;