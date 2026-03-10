const express = require('express');
const { body, validationResult } = require('express-validator');
const { 
  createCheckoutSession, 
  createPortalSession,
  handleWebhookEvent,
  SUBSCRIPTION_TIERS,
  stripe 
} = require('../lib/stripe');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

router.get('/plans', (req, res) => {
  try {
    const plans = Object.entries(SUBSCRIPTION_TIERS).map(([key, tier]) => ({
      id: key,
      name: tier.name,
      price: tier.price,
      accounts: tier.accounts,
      features: tier.features,
    }));

    res.json({
      success: true,
      data: plans,
    });
  } catch (error) {
    logger.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post(
  '/checkout',
  authenticateToken,
  body('tier').isIn(Object.keys(SUBSCRIPTION_TIERS)),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { tier } = req.body;
      const session = await createCheckoutSession(
        req.user.id,
        req.user.email,
        tier
      );

      res.json({
        success: true,
        url: session.url,
      });
    } catch (error) {
      logger.error('Checkout error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

router.post('/portal', authenticateToken, async (req, res) => {
  try {
    const session = await createPortalSession(req.user.stripeCustomerId);

    res.json({
      success: true,
      url: session.url,
    });
  } catch (error) {
    logger.error('Portal error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      const result = await handleWebhookEvent(event);
      if (result) {
        logger.info('Webhook processed:', result);
      }

      res.json({ received: true });
    } catch (error) {
      logger.error('Webhook error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        tier: req.user.subscriptionTier || 'FREE',
        status: 'active',
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (error) {
    logger.error('Subscription fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
