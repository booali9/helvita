const User = require('../models/User');
const BusinessProfile = require('../models/BusinessProfile');
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
    if (!user || user.accountType !== 'business') {
      return res.status(400).json({ error: 'Invalid user or account type' });
    }

    let profile = await BusinessProfile.findOne({ user: userId });
    if (!profile) {
      profile = new BusinessProfile({ user: userId, investmentType });
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

// Residence information
const addressSetup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { state, city, zipcode, residentialAddress } = req.body;
  const userId = req.userId;

  try {
    const user = await User.findById(userId);
    if (!user || user.accountType !== 'business') {
      return res.status(400).json({ error: 'Invalid user or account type' });
    }

    let profile = await BusinessProfile.findOne({ user: userId });
    if (!profile) {
      return res.status(400).json({ error: 'Complete investment setup first' });
    }

    profile.state = state;
    profile.city = city;
    profile.zipcode = zipcode;
    profile.residentialAddress = residentialAddress;

    await profile.save();
    res.json({ message: 'Address setup completed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Business details
const companyDetails = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    businessType,
    roleInBusiness,
    ownershipPercentage,
    businessRegisteredState,
    businessAddress,
    businessPhone,
    EIN,
    businessStartDate,
    websiteOrSocialLink,
    monthlyRevenue,
    transferPurpose
  } = req.body;
  const userId = req.userId;

  try {
    const user = await User.findById(userId);
    if (!user || user.accountType !== 'business') {
      return res.status(400).json({ error: 'Invalid user or account type' });
    }

    let profile = await BusinessProfile.findOne({ user: userId });
    if (!profile) {
      return res.status(400).json({ error: 'Complete previous steps first' });
    }

    profile.businessType = businessType;
    profile.roleInBusiness = roleInBusiness;
    profile.ownershipPercentage = ownershipPercentage;
    profile.businessRegisteredState = businessRegisteredState;
    profile.businessAddress = businessAddress;
    profile.businessPhone = businessPhone;
    profile.EIN = EIN;
    profile.businessStartDate = new Date(businessStartDate);
    profile.websiteOrSocialLink = websiteOrSocialLink;
    profile.monthlyRevenue = monthlyRevenue;
    profile.transferPurpose = transferPurpose;

    await profile.save();
    res.json({ message: 'Business details saved' });
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
    if (!user || user.accountType !== 'business') {
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

// Create Stripe Issuing Business Debit Card
const createCard = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { businessNameOnCard, deliveryAddress } = req.body;
  const userId = req.userId;

  try {
    const user = await User.findById(userId);
    if (!user || user.accountType !== 'business') {
      return res.status(400).json({ error: 'Invalid user or account type' });
    }

    if (!user.identityVerified) {
      return res.status(400).json({ error: 'Identity not verified' });
    }

    const card = await stripeService.createIssuingCard(userId, businessNameOnCard, 'business', deliveryAddress);
    user.stripeCardId = card.id;
    await user.save();

    res.json({ message: 'Business card created successfully', cardId: card.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  investmentSetup,
  addressSetup,
  companyDetails,
  startIdentityVerification,
  createCard
};