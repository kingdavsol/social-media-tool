const SUBSCRIPTION_LIMITS = {
  FREE: {
    tier: 'FREE',
    accounts: 1,
    postsPerMonth: 5,
    features: ['basic-scheduling', 'manual-posting'],
  },
  STARTER: {
    tier: 'STARTER',
    accounts: 5,
    postsPerMonth: 50,
    features: ['basic-scheduling', 'bulk-scheduling', 'basic-automation', 'monthly-analytics'],
  },
  PROFESSIONAL: {
    tier: 'PROFESSIONAL',
    accounts: 20,
    postsPerMonth: 999999,
    features: ['advanced-scheduling', 'bulk-scheduling', 'advanced-automation', 'weekly-analytics', 'content-calendar', 'ai-suggestions'],
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    accounts: 50,
    postsPerMonth: 999999,
    features: ['advanced-scheduling', 'bulk-scheduling', 'advanced-automation', 'real-time-analytics', 'team-collaboration', 'api-access', 'custom-integrations'],
  },
};

function subscriptionGate(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const tier = req.user.subscription_tier || 'FREE';
    const limits = SUBSCRIPTION_LIMITS[tier] || SUBSCRIPTION_LIMITS.FREE;
    req.subscription = limits;
    next();
  } catch (error) {
    console.error('Subscription gate error:', error);
    res.status(500).json({ error: 'Failed to check subscription' });
  }
}

function checkAccountLimit() {
  return async (req, res, next) => {
    if (!req.user || !req.subscription) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const accountCount = await req.db.collection('accounts').countDocuments({ user_id: req.user.id });
      
      if (accountCount >= req.subscription.accounts) {
        return res.status(429).json({
          error: 'Account limit reached for your tier',
          limit: req.subscription.accounts,
          current: accountCount,
          tier: req.subscription.tier,
        });
      }
      next();
    } catch (error) {
      console.error('Account limit check error:', error);
      res.status(500).json({ error: 'Failed to check account limit' });
    }
  };
}

function checkPostLimit() {
  return async (req, res, next) => {
    if (!req.user || !req.subscription) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const postCount = await req.db.collection('posts').countDocuments({
        user_id: req.user.id,
        created_at: { $gte: monthStart }
      });
      
      if (postCount >= req.subscription.postsPerMonth) {
        return res.status(429).json({
          error: 'Monthly post limit reached for your tier',
          limit: req.subscription.postsPerMonth,
          current: postCount,
          tier: req.subscription.tier,
          resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        });
      }
      next();
    } catch (error) {
      console.error('Post limit check error:', error);
      res.status(500).json({ error: 'Failed to check post limit' });
    }
  };
}

function requireFeature(feature) {
  return (req, res, next) => {
    if (!req.subscription?.features.includes(feature)) {
      return res.status(403).json({
        error: 'Feature not available in your tier',
        feature,
        currentTier: req.subscription?.tier,
      });
    }
    next();
  };
}

function getTierLimits(tier) {
  return SUBSCRIPTION_LIMITS[tier] || SUBSCRIPTION_LIMITS.FREE;
}

module.exports = {
  subscriptionGate,
  checkAccountLimit,
  checkPostLimit,
  requireFeature,
  getTierLimits,
  SUBSCRIPTION_LIMITS,
};
