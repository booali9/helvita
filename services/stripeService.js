const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const QRCode = require('qrcode');

const createIdentitySession = async (userId, returnUrl = null) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Create verification session with return_url for Stripe-hosted verification page
  const finalReturnUrl = returnUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verification-complete`;
  
  console.log('Creating identity session for user:', userId);
  console.log('Return URL:', finalReturnUrl);

  const sessionConfig = {
    type: 'document',
    metadata: {
      user_id: userId.toString()
    },
    return_url: finalReturnUrl
  };

  const session = await stripe.identity.verificationSessions.create(sessionConfig);
  
  console.log('Identity session created:', session.id);
  console.log('Verification URL:', session.url);

  return session;
};

const createIssuingCard = async (userId, nameOnCard, businessNameOnCard, cardDeliveryAddress) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Handle address - it can be either a string or object
  let addressLine1, addressCity, addressState, addressPostalCode;
  
  if (typeof cardDeliveryAddress === 'object' && cardDeliveryAddress !== null) {
    addressLine1 = cardDeliveryAddress.line1 || cardDeliveryAddress.address;
    addressCity = cardDeliveryAddress.city || user.city || 'Unknown';
    addressState = cardDeliveryAddress.state || user.state || 'CA';
    addressPostalCode = cardDeliveryAddress.postal_code || cardDeliveryAddress.zipCode || user.zipcode || '10001';
  } else {
    addressLine1 = cardDeliveryAddress || user.address || '123 Main St';
    addressCity = user.city || 'New York';
    addressState = user.state || 'NY';
    addressPostalCode = user.zipcode || '10001';
  }

  console.log('Creating cardholder with name:', nameOnCard);
  console.log('Business name:', businessNameOnCard);
  console.log('Delivery address:', addressLine1, addressCity, addressState, addressPostalCode);

  // Create a cardholder
  const cardholder = await stripe.issuing.cardholders.create({
    type: 'individual',
    name: nameOnCard,
    email: user.email,
    phone_number: user.businessPhone || user.phone || '+10000000000',
    billing: {
      address: {
        line1: addressLine1,
        city: addressCity,
        state: addressState,
        postal_code: addressPostalCode,
        country: 'US'
      }
    }
  });

  console.log('Cardholder created:', cardholder.id);

  // Create virtual card (physical cards require additional Stripe Issuing setup)
  const card = await stripe.issuing.cards.create({
    cardholder: cardholder.id,
    currency: 'usd',
    type: 'virtual',
    status: 'active'
  });

  console.log('Virtual card created:', card.id);

  // Store the cardholder name on the user for easy retrieval
  user.cardHolderName = nameOnCard;
  user.stripeCardholderId = cardholder.id;
  await user.save();

  return card;
};

const checkVerificationStatus = async (verificationSessionId) => {
  const session = await stripe.identity.verificationSessions.retrieve(verificationSessionId);
  return session;
};

const generateQRCode = async (verificationUrl) => {
  try {
    // Generate QR code from the Stripe-hosted verification URL
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.95,
      margin: 1,
      width: 300,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return qrCodeDataUrl;
  } catch (error) {
    throw new Error('Failed to generate QR code: ' + error.message);
  }
};

const handleIdentityWebhook = async (event) => {
  const session = event.data.object;
  const userId = session.metadata?.user_id;

  if (!userId) {
    console.log('No user_id in metadata, skipping webhook');
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    console.log('User not found for webhook:', userId);
    return;
  }

  switch (event.type) {
    case 'identity.verification_session.verified':
      // User successfully verified
      user.identityVerified = true;
      user.documentVerificationStatus = 'verified';
      user.documentVerificationDate = new Date();
      console.log('User verified:', userId);
      break;

    case 'identity.verification_session.requires_input':
      // Verification requires additional input from user
      user.documentVerificationStatus = 'requires_input';
      console.log('User verification requires input:', userId);
      break;

    case 'identity.verification_session.canceled':
      // Verification was canceled
      user.documentVerificationStatus = 'canceled';
      console.log('User verification canceled:', userId);
      break;

    case 'identity.verification_session.processing':
      // Verification is being processed
      user.documentVerificationStatus = 'processing';
      console.log('User verification processing:', userId);
      break;

    default:
      console.log('Unhandled identity event type:', event.type);
      return;
  }

  await user.save();
};

const blockCard = async (cardId) => {
  try {
    const card = await stripe.issuing.cards.update(cardId, {
      status: 'blocked',
    });
    return card;
  } catch (error) {
    throw new Error('Error blocking card: ' + error.message);
  }
};

const sendMoney = async (fromUserId, toUserId, amount, currency = 'usd') => {
  // This is a simplified P2P transfer using Stripe
  // In reality, need connected accounts or use Stripe's transfer API
  // For demo, assume users have Stripe customer IDs

  const fromUser = await User.findById(fromUserId);
  const toUser = await User.findById(toUserId);

  if (!fromUser.stripeCustomerId || !toUser.stripeCustomerId) {
    throw new Error('Users must have Stripe customer IDs');
  }

  // Create a payment intent from sender to receiver
  // But Stripe doesn't directly support P2P; this is simplified
  // Perhaps use Stripe's transfer for connected accounts

  // For now, throw error as it's complex
  throw new Error('P2P transfers not fully implemented; requires connected accounts');
};

const createInvoice = async (customerId, amount, description) => {
  try {
    const invoice = await stripe.invoices.create({
      customer: customerId,
      amount: amount * 100, // Amount in cents
      currency: 'usd',
      description,
    });
    return invoice;
  } catch (error) {
    throw new Error('Error creating invoice: ' + error.message);
  }
};

const listInvoices = async (customerId) => {
  try {
    const invoices = await stripe.invoices.list({
      customer: customerId,
    });
    return invoices.data;
  } catch (error) {
    throw new Error('Error listing invoices: ' + error.message);
  }
};

const createPaymentIntent = async (amount, currency = 'usd', paymentMethodId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency,
      payment_method: paymentMethodId,
      confirm: true,
    });
    return paymentIntent;
  } catch (error) {
    throw new Error('Error creating payment intent: ' + error.message);
  }
};

// Get card details from Stripe Issuing
const getCardDetails = async (cardId) => {
  try {
    const card = await stripe.issuing.cards.retrieve(cardId, {
      expand: ['cardholder']
    });
    return {
      id: card.id,
      last4: card.last4,
      expMonth: card.exp_month,
      expYear: card.exp_year,
      brand: card.brand || 'visa',
      status: card.status,
      type: card.type,
      cardholderName: card.cardholder?.name || 'Card Holder',
      created: card.created
    };
  } catch (error) {
    console.error('Error retrieving card details:', error.message);
    return null;
  }
};

// Get cardholder details
const getCardholderDetails = async (cardholderId) => {
  try {
    const cardholder = await stripe.issuing.cardholders.retrieve(cardholderId);
    return cardholder;
  } catch (error) {
    console.error('Error retrieving cardholder:', error.message);
    return null;
  }
};

module.exports = {
  createIdentitySession,
  createIssuingCard,
  checkVerificationStatus,
  generateQRCode,
  handleIdentityWebhook,
  blockCard,
  sendMoney,
  createInvoice,
  listInvoices,
  createPaymentIntent,
  getCardDetails,
  getCardholderDetails
};