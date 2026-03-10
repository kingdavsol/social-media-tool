const express = require('express');
const { SUBSCRIPTION_TIERS } = require('../lib/stripe');

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
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post('/checkout', (req, res) => {
  try {
    const { tier } = req.body;
    res.json({
      success: true,
      message: 'Checkout endpoint - configure Stripe keys in environment',
      tier
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
