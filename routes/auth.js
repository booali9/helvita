const express = require('express');
const { body } = require('express-validator');
const { register, verifyOtp, login, getProfile, getReferrals, deleteAccount, forgotPassword, verifyResetOtp, resetPassword } = require('../controllers/authController');
const auth = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - accountType
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               accountType:
 *                 type: string
 *                 enum: [personal, business]
 *     responses:
 *       200:
 *         description: OTP sent to email
 *       400:
 *         description: Validation error
 */
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('accountType').isIn(['personal', 'business'])
], register);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify OTP sent to email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid OTP
 */
router.post('/verify-otp', [
  body('email').isEmail().normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric()
], verifyOtp);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       400:
 *         description: Invalid credentials or account not approved
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], login);

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Get user profile with card details
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 profile:
 *                   type: object
 *                 card:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/profile', auth, getProfile);

// Get user's referrals
router.get('/referrals', auth, getReferrals);

// Delete user account
router.delete('/delete-account', auth, deleteAccount);

// Forgot Password - Request OTP
/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP sent to email
 *       400:
 *         description: Validation error
 */
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], forgotPassword);

// Verify Reset OTP
/**
 * @swagger
 * /auth/verify-reset-otp:
 *   post:
 *     summary: Verify password reset OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid OTP
 */
router.post('/verify-reset-otp', [
  body('email').isEmail().normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric()
], verifyResetOtp);

// Reset Password
/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password with OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid OTP or validation error
 */
router.post('/reset-password', [
  body('email').isEmail().normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric(),
  body('newPassword').isLength({ min: 6 })
], resetPassword);

// Get referral link
router.get('/referral-link', auth, (req, res) => {
  const userId = req.user.id;
  const referralLink = `${process.env.FRONTEND_URL}/register?ref=${req.user.referralCode}`;
  res.json({ referralLink });
});

module.exports = router;