const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const stripeService = require('../services/stripeService');

const router = express.Router();

// Stripe webhook for identity verification
router.post('/stripe-identity', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  console.log('Received webhook request');
  console.log('Signature present:', !!sig);
  console.log('Endpoint secret present:', !!endpointSecret);
  console.log('Body type:', typeof req.body);
  console.log('Is Buffer:', Buffer.isBuffer(req.body));
  console.log('Has rawBody:', !!req.rawBody);

  let event;

  try {
    // Use rawBody if available (set by server.js), otherwise use req.body
    const payload = req.rawBody || req.body;
    
    event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
    console.log('Webhook event type:', event.type);
    console.log('Event data:', JSON.stringify(event.data.object, null, 2));
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await stripeService.handleIdentityWebhook(event);
    console.log('Webhook processed successfully');
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;