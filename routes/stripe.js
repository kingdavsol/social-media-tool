const express = require('express');
const { SUBSCRIPTION_TIERS } = require('../lib/stripe');
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

router.post('/checkout', async (req, res) => {
  try {
    const { tier } = req.body;
    res.json({
      success: true,
      message: 'Checkout coming soon - configure Stripe price IDs first',
      tier
    });
  } catch (error) {
    logger.error('Checkout error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
