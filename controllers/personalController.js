const User = require('../models/User');
const PersonalProfile = require('../models/PersonalProfile');
const { validationResult } = require('express-validator');
const stripeService = require('../services/stripeService');

// Investment account info
const investmentSetup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { investmentType } = req.body;
  const userId = req.userId;

  try {
    const user = await User.findById(userId);
    if (!user || user.accountType !== 'personal') {
      return res.status(400).json({ error: 'Invalid user or account type' });
    }

    let profile = await PersonalProfile.findOne({ user: userId });
    if (!profile) {
      profile = new PersonalProfile({ user: userId, investmentType });
    } else {
      profile.investmentType = investmentType;
    }

    await profile.save();
    res.json({ message: 'Investment setup completed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Personal details
const personalDetails = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { fullName, address, state, city, zipcode, SSN, dateOfBirth } = req.body;
  const userId = req.userId;

  try {
    const user = await User.findById(userId);
    if (!user || user.accountType !== 'personal') {
      return res.status(400).json({ error: 'Invalid user or account type' });
    }

    let profile = await PersonalProfile.findOne({ user: userId });
    if (!profile) {
      return res.status(400).json({ error: 'Complete investment setup first' });
    }

    profile.fullName = fullName;
    profile.address = address;
    profile.state = state;
    profile.city = city;
    profile.zipcode = zipcode;
    profile.SSN = SSN;
    profile.dateOfBirth = new Date(dateOfBirth);

    await profile.save();
    res.json({ message: 'Personal details saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Bank account setup
const bankSetup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { accountName, accountType, routingNumber, accountNumber } = req.body;
  const userId = req.userId;

  try {
    const user = await User.findById(userId);
    if (!user || user.accountType !== 'personal') {
      return res.status(400).json({ error: 'Invalid user or account type' });
    }

    let profile = await PersonalProfile.findOne({ user: userId });
    if (!profile) {
      return res.status(400).json({ error: 'Complete previous steps first' });
    }

    profile.accountName = accountName;
    profile.accountType = accountType;
    profile.routingNumber = routingNumber;
    profile.accountNumber = accountNumber;

    await profile.save();
    res.json({ message: 'Bank setup completed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Identity Verification (Stripe Identity)
const startIdentityVerification = async (req, res) => {
  const userId = req.userId;

  try {
    const user = await User.findById(userId);
    if (!user || user.accountType !== 'personal') {
      return res.status(400).json({ error: 'Invalid user or account type' });
    }

    const session = await stripeService.createIdentitySession(userId);
    user.stripeIdentitySessionId = session.id;
    await user.save();

    res.json({ sessionUrl: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Issue Stripe Debit Card
const createCard = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { nameOnCard, cardType, deliveryAddress } = req.body;
  const userId = req.userId;

  try {
    const user = await User.findById(userId);
    if (!user || user.accountType !== 'personal') {
      return res.status(400).json({ error: 'Invalid user or account type' });
    }

    if (!user.identityVerified) {
      return res.status(400).json({ error: 'Identity not verified' });
    }

    const card = await stripeService.createIssuingCard(userId, nameOnCard, cardType, deliveryAddress);
    user.stripeCardId = card.id;
    await user.save();

    res.json({ message: 'Card created successfully', cardId: card.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  investmentSetup,
  personalDetails,
  bankSetup,
  startIdentityVerification,
  createCard
};