const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

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
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
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
    priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
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
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
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

async function createCheckoutSession(userId, email, tier) {
  const tierConfig = SUBSCRIPTION_TIERS[tier];
  if (!tierConfig || !tierConfig.priceId) {
    throw new Error(`Invalid tier: ${tier}`);
  }

  const session = await stripe.checkout.sessions.create({
    customer_email: email,
    client_reference_id: userId,
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [
      {
        price: tierConfig.priceId,
        quantity: 1,
      },
    ],
    success_url: `${process.env.APP_URL}/dashboard?success=true`,
    cancel_url: `${process.env.APP_URL}/pricing?canceled=true`,
    metadata: {
      userId,
      tier,
    },
  });

  return session;
}

async function createPortalSession(customerId) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.APP_URL}/dashboard/settings`,
  });

  return session;
}

async function handleWebhookEvent(event) {
  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.created':
      return handleSubscriptionUpdate(event.data.object);
    case 'customer.subscription.deleted':
      return handleSubscriptionCanceled(event.data.object);
    case 'invoice.payment_succeeded':
      return handlePaymentSuccess(event.data.object);
    default:
      return null;
  }
}

async function handleSubscriptionUpdate(subscription) {
  return {
    userId: subscription.metadata.userId,
    tier: subscription.metadata.tier,
    status: subscription.status,
  };
}

async function handleSubscriptionCanceled(subscription) {
  return {
    userId: subscription.metadata.userId,
    tier: 'FREE',
    status: 'canceled',
  };
}

async function handlePaymentSuccess(invoice) {
  return {
    userId: invoice.metadata?.userId,
    amount: invoice.amount_paid,
    status: 'succeeded',
  };
}

module.exports = {
  stripe,
  SUBSCRIPTION_TIERS,
  createCheckoutSession,
  createPortalSession,
  handleWebhookEvent,
};
