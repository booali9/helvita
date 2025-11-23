const express = require('express');
const { body } = require('express-validator');
const authMiddleware = require('../middlewares/auth');
const {
  getPendingUsers,
  approveUser,
  rejectUser
} = require('../controllers/adminController');

const router = express.Router();

// All routes require authentication (assuming admin auth)
router.use(authMiddleware);

// Get all users waiting for review
router.get('/users/pending', getPendingUsers);

// Approve user account
router.post('/users/:userId/approve', [
  body('userId').isMongoId()
], approveUser);

// Reject user account
router.post('/users/:userId/reject', [
  body('userId').isMongoId(),
  body('reason').notEmpty()
], rejectUser);

module.exports = router;