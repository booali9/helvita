const User = require('../models/User');
const { createIdentitySession, createIssuingCard, checkVerificationStatus, generateQRCode, handleIdentityWebhook } = require('../services/stripeService');

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

// Stripe Identity for personal (also works for any account type)
const personalIdentity = async (req, res) => {
  const { email } = req.body;

  console.log('Personal identity request for email:', email);

  try {
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('User not found:', email);
      return res.status(400).json({ msg: 'User not found' });
    }

    console.log('User found:', user.email, 'Account type:', user.accountType);

    // Use stripeService to create identity session with return URL
    const verificationSession = await createIdentitySession(user._id);

    user.stripeIdentityId = verificationSession.id;
    await user.save();

    // Return both client_secret (for backward compatibility) and the Stripe-hosted URL
    res.json({ 
      client_secret: verificationSession.client_secret,
      verification_url: verificationSession.url,
      session_id: verificationSession.id
    });
  } catch (err) {
    console.error('Personal identity error:', err.message);
    res.status(500).send('Server error');
  }
};

// Stripe Identity for business (also works for any account type)
const businessIdentity = async (req, res) => {
  const { email } = req.body;

  console.log('Business identity request for email:', email);

  try {
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('User not found:', email);
      return res.status(400).json({ msg: 'User not found' });
    }
    
    console.log('User found:', user.email, 'Account type:', user.accountType);

    // Use stripeService to create identity session with return URL
    const verificationSession = await createIdentitySession(user._id);

    // Save to appropriate field based on account type
    if (user.accountType === 'business') {
      user.businessStripeIdentityId = verificationSession.id;
    } else {
      user.stripeIdentityId = verificationSession.id;
    }
    await user.save();

    // Return both client_secret (for backward compatibility) and the Stripe-hosted URL
    res.json({ 
      client_secret: verificationSession.client_secret,
      verification_url: verificationSession.url,
      session_id: verificationSession.id
    });
  } catch (err) {
    console.error('Business identity error:', err.message);
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

    // Use stripeService to create issuing card
    const card = await createIssuingCard(user._id, cardName, businessNameOnCard, cardDeliveryAddress);

    user.stripeCardId = card.id;
    user.cardName = cardName;
    user.businessNameOnCard = businessNameOnCard;
    user.cardDeliveryAddress = cardDeliveryAddress;
    await user.save();

    res.json({ msg: 'Card created', cardId: card.id });
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

// Verify document status after mobile scan
const verifyDocumentStatus = async (req, res) => {
  const { email, verificationSessionId } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    // Check verification status from Stripe
    const verificationSession = await checkVerificationStatus(verificationSessionId);

    if (!verificationSession) {
      return res.status(400).json({ msg: 'Verification session not found' });
    }

    // Check if verification is complete and approved
    if (verificationSession.status === 'verified') {
      // Update user document verification status
      user.identityVerified = true;
      user.documentVerificationStatus = 'verified';
      user.documentVerificationDate = new Date();
      await user.save();

      return res.json({
        success: true,
        msg: 'Documents verified successfully',
        status: 'verified',
        canProceed: true
      });
    } else if (verificationSession.status === 'requires_input') {
      return res.json({
        success: false,
        msg: 'Verification requires additional input',
        status: 'requires_input',
        canProceed: false
      });
    } else if (verificationSession.status === 'unverified') {
      return res.json({
        success: false,
        msg: 'Documents could not be verified',
        status: 'unverified',
        canProceed: false
      });
    } else {
      return res.json({
        success: false,
        msg: 'Verification still in progress',
        status: verificationSession.status,
        canProceed: false
      });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Generate QR code for mobile verification
const generateVerificationQRCode = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    // Get the verification session ID from user (either personal or business)
    const verificationSessionId = user.stripeIdentityId || user.businessStripeIdentityId;
    
    if (!verificationSessionId) {
      return res.status(400).json({ msg: 'No verification session found. Please start identity verification first.' });
    }

    // Retrieve the verification session to get the Stripe-hosted URL
    const verificationSession = await checkVerificationStatus(verificationSessionId);
    
    if (!verificationSession) {
      return res.status(400).json({ msg: 'Verification session not found in Stripe' });
    }

    // Check if session already has a URL, if not or if expired, the URL might not be available
    if (!verificationSession.url) {
      return res.status(400).json({ 
        msg: 'Verification session URL not available. Please create a new verification session.',
        needsNewSession: true 
      });
    }

    // Generate QR code using the Stripe-hosted verification URL
    const qrCodeDataUrl = await generateQRCode(verificationSession.url);

    // Save the verification session ID to user for later verification
    user.currentVerificationSessionId = verificationSessionId;
    await user.save();

    res.json({
      success: true,
      qrCode: qrCodeDataUrl,
      verificationUrl: verificationSession.url,
      verificationSessionId: verificationSessionId,
      msg: 'QR code generated successfully. Scan with your mobile device to upload documents on the Stripe verification page.'
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

module.exports = {
  personalSetup,
  businessSetup,
  personalIdentity,
  businessIdentity,
  createCard,
  acceptTerms,
  adminApprove,
  verifyDocumentStatus,
  generateVerificationQRCode
};