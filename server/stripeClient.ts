import Stripe from 'stripe';

function getStripeSecretKeySync(): string | null {
  return process.env.STRIPE_SECRET_KEY || null;
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const secretKey = getStripeSecretKeySync();
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(secretKey, { apiVersion: '2025-11-17.clover' as any });
}

export async function getStripePublishableKey(): Promise<string> {
  const key = process.env.STRIPE_PUBLISHABLE_KEY || '';
  return key;
}

export async function getStripeSecretKey(): Promise<string> {
  const secretKey = getStripeSecretKeySync();
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY not configured');
  return secretKey;
}

// Stub — stripe-replit-sync is not used outside Replit
export async function getStripeSync(): Promise<null> {
  return null;
}
