const stripeService = require('../services/stripeService');
const User = require('../models/User');

// Block card
const blockCard = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user.stripeCardId) {
      return res.status(400).json({ error: 'No card found' });
    }

    const card = await stripeService.blockCard(user.stripeCardId);
    res.json({ message: 'Card blocked successfully', card });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Change PIN - Not supported for physical cards
const changePin = async (req, res) => {
  res.status(400).json({ error: 'Changing PIN is not supported for physical cards' });
};

// Request a new card
const requestCard = async (req, res) => {
  try {
    const userId = req.user.id;
    const { nameOnCard, businessNameOnCard, cardDeliveryAddress } = req.body;

    const card = await stripeService.createIssuingCard(userId, nameOnCard, businessNameOnCard, cardDeliveryAddress);

    // Save card ID to user
    await User.findByIdAndUpdate(userId, { stripeCardId: card.id });

    res.json({ message: 'Card requested successfully', card });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create invoice
const createInvoice = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user.stripeCustomerId) {
      return res.status(400).json({ error: 'No Stripe customer ID' });
    }

    const { amount, description } = req.body;
    const invoice = await stripeService.createInvoice(user.stripeCustomerId, amount, description);
    res.json({ message: 'Invoice created successfully', invoice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// List invoices
const listInvoices = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user.stripeCustomerId) {
      return res.status(400).json({ error: 'No Stripe customer ID' });
    }

    const invoices = await stripeService.listInvoices(user.stripeCustomerId);
    res.json({ invoices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Make payment
const makePayment = async (req, res) => {
  try {
    const { amount, paymentMethodId } = req.body;
    const paymentIntent = await stripeService.createPaymentIntent(amount, 'usd', paymentMethodId);
    res.json({ message: 'Payment processed successfully', paymentIntent });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  blockCard,
  changePin,
  requestCard,
  createInvoice,
  listInvoices,
  makePayment,
};