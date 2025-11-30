const express = require('express');
const {
  personalSetup,
  businessSetup,
  personalIdentity,
  businessIdentity,
  createCard,
  acceptTerms,
  adminApprove,
  verifyDocumentStatus,
  generateVerificationQRCode
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

// Generate QR code for verification
router.post('/generate-qr-code', generateVerificationQRCode);

// Verify document status after mobile scan
router.post('/verify-document-status', verifyDocumentStatus);

// Accept terms
router.post('/accept-terms', acceptTerms);

// Admin approve account
router.post('/admin-approve', adminApprove);

module.exports = router;