const express = require('express');
const {
  personalSetup,
  businessSetup,
  personalIdentity,
  businessIdentity,
  createCard,
  acceptTerms,
  adminApprove
} = require('../controllers/setupController');

const router = express.Router();

// Personal account setup
router.post('/personal-setup', personalSetup);

// Business account setup
router.post('/business-setup', businessSetup);

// Stripe Identity for personal
router.post('/personal-identity', personalIdentity);

// Stripe Identity for business
router.post('/business-identity', businessIdentity);

// Create card via Stripe
router.post('/create-card', createCard);

// Accept terms
router.post('/accept-terms', acceptTerms);

// Admin approve account
router.post('/admin-approve', adminApprove);

module.exports = router;