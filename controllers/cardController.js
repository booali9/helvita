const stripeService = require('../services/stripeService');
const User = require('../models/User');

// Get billing history from Stripe
const getBillingHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let billingHistory = [];

    // If user has a Stripe customer ID, fetch real billing data
    if (user.stripeCustomerId) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        
        // Get invoices from Stripe
        const invoices = await stripe.invoices.list({
          customer: user.stripeCustomerId,
          limit: 50,
        });

        // Get charges from Stripe
        const charges = await stripe.charges.list({
          customer: user.stripeCustomerId,
          limit: 50,
        });

        // Format invoices
        invoices.data.forEach(invoice => {
          billingHistory.push({
            id: invoice.id,
            date: new Date(invoice.created * 1000).toISOString().split('T')[0],
            description: invoice.description || 'Invoice',
            amount: (invoice.amount_paid / 100).toFixed(2),
            currency: invoice.currency.toUpperCase(),
            status: invoice.status === 'paid' ? 'Paid' : invoice.status === 'open' ? 'Pending' : invoice.status,
            type: 'invoice'
          });
        });

        // Format charges
        charges.data.forEach(charge => {
          // Avoid duplicates from invoices
          if (!charge.invoice) {
            billingHistory.push({
              id: charge.id,
              date: new Date(charge.created * 1000).toISOString().split('T')[0],
              description: charge.description || 'Payment',
              amount: (charge.amount / 100).toFixed(2),
              currency: charge.currency.toUpperCase(),
              status: charge.status === 'succeeded' ? 'Paid' : charge.status === 'pending' ? 'Pending' : 'Failed',
              type: 'charge'
            });
          }
        });

        // Sort by date descending
        billingHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

      } catch (stripeError) {
        console.error('Stripe billing fetch error:', stripeError.message);
        // Continue with empty billing if Stripe fails
      }
    }

    // Also include transfers as billing activity
    if (user.transfers && user.transfers.length > 0) {
      user.transfers.forEach(transfer => {
        billingHistory.push({
          id: transfer.id || transfer.stripePaymentIntentId,
          date: new Date(transfer.createdAt).toISOString().split('T')[0],
          description: transfer.description || `Transfer to ${transfer.destination}`,
          amount: transfer.amount.toFixed(2),
          currency: 'USD',
          status: transfer.status === 'completed' ? 'Paid' : transfer.status === 'pending' ? 'Pending' : transfer.status,
          type: 'transfer'
        });
      });

      // Re-sort after adding transfers
      billingHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    res.json({
      success: true,
      billingHistory: billingHistory,
      total: billingHistory.length
    });

  } catch (error) {
    console.error('Error fetching billing history:', error);
    res.status(500).json({ error: error.message });
  }
};

// Add external card/payment method
const addCard = async (req, res) => {
  try {
    const userId = req.userId;
    const { cardNumber, cardName, expiry, cvv } = req.body;

    console.log('Add card request:', { userId, cardNumber: cardNumber?.slice(-4), cardName, expiry });

    if (!cardNumber || !cardName || !expiry) {
      return res.status(400).json({ error: 'Card number, name and expiry are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Parse expiry date safely
    let expMonth = 12;
    let expYear = 2029;
    
    if (expiry.includes('/')) {
      const parts = expiry.split('/');
      expMonth = parseInt(parts[0]) || 12;
      const yearPart = parts[1] || '29';
      expYear = yearPart.length === 2 ? parseInt('20' + yearPart) : parseInt(yearPart);
    }

    // Store card details (in production, you'd use Stripe to tokenize)
    // For now, we'll store a masked version in the user's saved cards
    const maskedCard = {
      id: `card_${Date.now()}`,
      last4: cardNumber.slice(-4),
      brand: detectCardBrand(cardNumber),
      cardholderName: cardName,
      expMonth: expMonth,
      expYear: expYear,
      cardType: 'external',
      addedAt: new Date()
    };

    // Add to user's saved cards array
    if (!user.savedCards) {
      user.savedCards = [];
    }
    user.savedCards.push(maskedCard);
    await user.save();

    console.log('Card added successfully:', maskedCard.id);
    res.json({ message: 'Card added successfully', card: maskedCard });
  } catch (error) {
    console.error('Error adding card:', error);
    res.status(500).json({ error: error.message });
  }
};

// Helper function to detect card brand
const detectCardBrand = (cardNumber) => {
  const num = cardNumber.replace(/\s/g, '');
  if (/^4/.test(num)) return 'visa';
  if (/^5[1-5]/.test(num)) return 'mastercard';
  if (/^3[47]/.test(num)) return 'amex';
  if (/^6(?:011|5)/.test(num)) return 'discover';
  return 'unknown';
};

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
  addCard,
  blockCard,
  changePin,
  requestCard,
  createInvoice,
  listInvoices,
  makePayment,
  getBillingHistory,
};