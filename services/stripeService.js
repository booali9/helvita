const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');

const createIdentitySession = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const session = await stripe.identity.verificationSessions.create({
    type: 'document',
    metadata: {
      user_id: userId.toString()
    }
  });

  return session;
};

const createIssuingCard = async (userId, nameOnCard, cardType, deliveryAddress) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Create or retrieve customer
  let customer;
  if (user.stripeCustomerId) {
    customer = await stripe.customers.retrieve(user.stripeCustomerId);
  } else {
    customer = await stripe.customers.create({
      email: user.email,
      name: nameOnCard
    });
    user.stripeCustomerId = customer.id;
    await user.save();
  }

  // Create issuing card
  const card = await stripe.issuing.cards.create({
    cardholder: customer.id,
    currency: 'usd',
    type: 'virtual',
    status: 'active'
  });

  return card;
};

const handleIdentityWebhook = async (event) => {
  if (event.type === 'identity.verification_session.verified') {
    const session = event.data.object;
    const userId = session.metadata.user_id;

    const user = await User.findById(userId);
    if (user) {
      user.identityVerified = true;
      await user.save();
    }
  }
};

module.exports = {
  createIdentitySession,
  createIssuingCard,
  handleIdentityWebhook
};