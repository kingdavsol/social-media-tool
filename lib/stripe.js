// Stripe configuration module
// Stripe client will be initialized when environment variables are set

const SUBSCRIPTION_TIERS = {
  FREE: {
    name: 'Free',
    price: 0,
    accounts: 1,
    features: [
      '1 social media account',
      'Basic scheduling (5 posts/month)',
      'Manual posting only',
      'Limited analytics',
      'Community support',
    ],
  },
  STARTER: {
    name: 'Starter',
    price: 4.99,
    accounts: 5,
    features: [
      'Up to 5 accounts',
      'Scheduled posting (50 posts/month)',
      'Basic automation',
      'Monthly analytics',
      'Email support',
      'Bulk scheduling',
    ],
  },
  PROFESSIONAL: {
    name: 'Professional',
    price: 9.99,
    accounts: 20,
    features: [
      'Up to 20 accounts',
      'Unlimited scheduled posts',
      'Advanced automation rules',
      'Weekly analytics reports',
      'Priority email support',
      'Content calendar',
      'AI-powered post suggestions',
    ],
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: 19.99,
    accounts: 50,
    features: [
      'Up to 50 accounts',
      'Unlimited posts & scheduling',
      'Advanced automation',
      'Real-time analytics',
      'Dedicated support',
      'Team collaboration (5 users)',
      'Advanced AI features',
      'API access',
      'Custom integrations',
    ],
  },
};

module.exports = {
  SUBSCRIPTION_TIERS,
};
