import Stripe from 'stripe';

let cachedClient: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY not configured');
  if (!cachedClient) {
    cachedClient = new Stripe(secretKey, { apiVersion: '2025-11-17.clover' as any });
  }
  return cachedClient;
}

// Back-compat alias for older async call sites
export async function getUncachableStripeClient(): Promise<Stripe> {
  return getStripe();
}

export async function getStripePublishableKey(): Promise<string> {
  return process.env.STRIPE_PUBLISHABLE_KEY || '';
}
