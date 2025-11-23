const User = require('../models/User');
const PersonalProfile = require('../models/PersonalProfile');
const BusinessProfile = require('../models/BusinessProfile');
const { validationResult } = require('express-validator');

// Get all users waiting for review
const getPendingUsers = async (req, res) => {
  try {
    const users = await User.find({
      emailVerified: true,
      identityVerified: true,
      adminApproved: false
    }).select('email accountType createdAt');

    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Approve user account
const approveUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.emailVerified || !user.identityVerified) {
      return res.status(400).json({ error: 'User not fully verified' });
    }

    user.adminApproved = true;
    await user.save();

    res.json({ message: 'User approved successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Reject user account
const rejectUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { userId } = req.params;
  const { reason } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.adminApproved = false;
    // You might want to add a rejection reason field to the schema
    await user.save();

    res.json({ message: 'User rejected', reason });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getPendingUsers,
  approveUser,
  rejectUser
};