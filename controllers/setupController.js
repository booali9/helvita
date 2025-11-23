const User = require('../models/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Personal account setup
const personalSetup = async (req, res) => {
  const { email, investmentType, fullName, address, state, ssn, accountName, accountTypeDetail, routingNumber } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || user.accountType !== 'personal') {
      return res.status(400).json({ msg: 'Invalid user or account type' });
    }

    user.investmentType = investmentType;
    user.fullName = fullName;
    user.address = address;
    user.state = state;
    user.ssn = ssn;
    user.accountName = accountName;
    user.accountTypeDetail = accountTypeDetail;
    user.routingNumber = routingNumber;

    await user.save();

    res.json({ msg: 'Personal details saved' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Business account setup
const businessSetup = async (req, res) => {
  const { email, investmentType, state, address, city, zipcode, businessType, roleInBusiness, ownershipPercentage, businessRegisteredState, businessAddress, businessPhone, ein, businessStartDate, website, monthlyRevenue, transferMethod } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || user.accountType !== 'business') {
      return res.status(400).json({ msg: 'Invalid user or account type' });
    }

    user.investmentType = investmentType;
    user.state = state;
    user.address = address;
    user.city = city;
    user.zipcode = zipcode;
    user.businessType = businessType;
    user.roleInBusiness = roleInBusiness;
    user.ownershipPercentage = ownershipPercentage;
    user.businessRegisteredState = businessRegisteredState;
    user.businessAddress = businessAddress;
    user.businessPhone = businessPhone;
    user.ein = ein;
    user.businessStartDate = businessStartDate;
    user.website = website;
    user.monthlyRevenue = monthlyRevenue;
    user.transferMethod = transferMethod;

    await user.save();

    res.json({ msg: 'Business details saved' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Stripe Identity for personal
const personalIdentity = async (req, res) => {
  const { email, idDocument } = req.body; // idDocument could be base64 or file

  try {
    const user = await User.findOne({ email });
    if (!user || user.accountType !== 'personal') {
      return res.status(400).json({ msg: 'Invalid user' });
    }

    // Create Stripe Identity verification session
    const verificationSession = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: {
        user_id: user._id.toString()
      }
    });

    user.stripeIdentityId = verificationSession.id;
    await user.save();

    res.json({ client_secret: verificationSession.client_secret });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Stripe Identity for business
const businessIdentity = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || user.accountType !== 'business') {
      return res.status(400).json({ msg: 'Invalid user' });
    }

    const verificationSession = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: {
        user_id: user._id.toString()
      }
    });

    user.businessStripeIdentityId = verificationSession.id;
    await user.save();

    res.json({ client_secret: verificationSession.client_secret });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Create card via Stripe
const createCard = async (req, res) => {
  const { email, cardName, businessNameOnCard, cardDeliveryAddress } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    // Create a cardholder
    const cardholder = await stripe.issuing.cardholders.create({
      type: 'individual',
      name: cardName,
      email: user.email,
      phone_number: user.businessPhone || '+1234567890', // placeholder
      billing: {
        address: {
          line1: cardDeliveryAddress,
          city: user.city || 'City',
          state: user.state,
          postal_code: user.zipcode || '12345',
          country: 'US'
        }
      }
    });

    // Create card
    const card = await stripe.issuing.cards.create({
      cardholder: cardholder.id,
      currency: 'usd',
      type: 'physical',
      shipping: {
        name: cardName,
        address: {
          line1: cardDeliveryAddress,
          city: user.city || 'City',
          state: user.state,
          postal_code: user.zipcode || '12345',
          country: 'US'
        }
      }
    });

    user.stripeCardId = card.id;
    user.cardName = cardName;
    user.businessNameOnCard = businessNameOnCard;
    user.cardDeliveryAddress = cardDeliveryAddress;
    await user.save();

    res.json({ msg: 'Card created' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Accept terms
const acceptTerms = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    user.termsAccepted = true;
    await user.save();

    res.json({ msg: 'Terms accepted' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Admin approve account
const adminApprove = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    user.isApproved = true;
    await user.save();

    res.json({ msg: 'Account approved' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

module.exports = {
  personalSetup,
  businessSetup,
  personalIdentity,
  businessIdentity,
  createCard,
  acceptTerms,
  adminApprove
};