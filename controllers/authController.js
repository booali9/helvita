const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const otpService = require('../services/otpService');
const jwtService = require('../services/jwtService');

// Register user
const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, accountType } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      email,
      password: hashedPassword,
      accountType
    });

    await user.save();

    // Generate and send OTP
    const otp = otpService.generateOTP();
    user.otp = otp;
    user.otpExpires = Date.now() + parseInt(process.env.OTP_EXPIRY) * 60 * 1000;
    await user.save();

    await otpService.sendOTP(email, otp);

    res.json({ message: 'OTP sent to email' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// Verify OTP
const verifyOtp = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, otp } = req.body;

  try {
    const user = await otpService.verifyOTP(email, otp);
    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Login
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (!user.emailVerified) {
      return res.status(400).json({ error: 'Email not verified' });
    }

    if (!user.identityVerified) {
      return res.status(400).json({ error: 'Identity not verified' });
    }

    if (!user.adminApproved) {
      return res.status(400).json({ error: 'Account not approved by admin' });
    }

    const token = jwtService.generateToken(user._id);
    res.json({ token });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  register,
  verifyOtp,
  login
};