/**
 * Idempotent Stripe setup for the canonical pricing model:
 *   Free — $0 (display only)
 *   Pro  — $23/mo base + $7/mo per additional seat
 *
 * Prices are tagged with stable lookup keys so the server resolves them
 * without amount matching. Safe to re-run: existing lookup keys are reused.
 *
 * Usage: STRIPE_SECRET_KEY=sk_... tsx scripts/seed-products.ts
 */
import Stripe from 'stripe';
import {
  PRO_BASE_LOOKUP_KEY,
  PRO_SEAT_LOOKUP_KEY,
  STRIPE_BASE_PRICE,
  STRIPE_SEAT_PRICE,
} from '../server/services/billingService';

async function findProductByTier(stripe: Stripe, tier: string): Promise<Stripe.Product | null> {
  const products = await stripe.products.list({ active: true, limit: 100 });
  return products.data.find((p) => p.metadata?.tier === tier) ?? null;
}

async function ensureProduct(
  stripe: Stripe,
  tier: string,
  params: Stripe.ProductCreateParams
): Promise<Stripe.Product> {
  const existing = await findProductByTier(stripe, tier);
  if (existing) {
    console.log(`Product for tier "${tier}" already exists: ${existing.id} (${existing.name})`);
    return existing;
  }
  const product = await stripe.products.create(params);
  console.log(`Created product "${product.name}": ${product.id}`);
  return product;
}

async function ensurePrice(
  stripe: Stripe,
  lookupKey: string,
  params: Stripe.PriceCreateParams
): Promise<Stripe.Price> {
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (existing.data.length > 0) {
    console.log(`Price ${lookupKey} already exists: ${existing.data[0].id}`);
    return existing.data[0];
  }
  const price = await stripe.prices.create({ ...params, lookup_key: lookupKey, transfer_lookup_key: true });
  console.log(`Created price ${lookupKey}: ${price.id} ($${(params.unit_amount! / 100).toFixed(2)}/${params.recurring?.interval})`);
  return price;
}

async function seedProducts() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('STRIPE_SECRET_KEY is required');
    process.exit(1);
  }
  const stripe = new Stripe(secretKey, { apiVersion: '2025-11-17.clover' as any });

  console.log('Setting up FlowCapture Stripe products and prices...\n');

  // Free — displayed on the pricing page, never checked out
  const freeProduct = await ensureProduct(stripe, 'free', {
    name: 'Free',
    description: 'Perfect for individuals getting started with workflow documentation',
    metadata: {
      tier: 'free',
      features: JSON.stringify([
        '1 workspace',
        '1 user',
        'Unlimited flows',
        'Chrome extension',
        'Screenshot capture',
        'Basic export options',
      ]),
    },
  });
  await ensurePrice(stripe, 'flowcapture_free', {
    product: freeProduct.id,
    unit_amount: 0,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { tier: 'free' },
  });

  // Pro — base subscription
  const proProduct = await ensureProduct(stripe, 'pro', {
    name: 'Pro',
    description: 'For teams and growing organizations',
    metadata: {
      tier: 'pro',
      popular: 'true',
      features: JSON.stringify([
        'Unlimited workspaces',
        '1 user included, add more anytime',
        'AI-powered descriptions & translations',
        'Team collaboration & approvals',
        'Integrations & automations',
        'Password-protected sharing',
        'Analytics dashboard',
        'Priority support',
      ]),
    },
  });
  const basePrice = await ensurePrice(stripe, PRO_BASE_LOOKUP_KEY, {
    product: proProduct.id,
    unit_amount: STRIPE_BASE_PRICE,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { tier: 'pro', billing: 'monthly' },
  });

  // Pro seat add-on — hidden from the pricing page, attached at checkout
  const seatProduct = await ensureProduct(stripe, 'pro_seat', {
    name: 'Pro — Additional Seat',
    description: 'Additional team member seat for the Pro plan',
    metadata: { tier: 'pro_seat', hidden: 'true' },
  });
  const seatPrice = await ensurePrice(stripe, PRO_SEAT_LOOKUP_KEY, {
    product: seatProduct.id,
    unit_amount: STRIPE_SEAT_PRICE,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { tier: 'pro_seat', hidden: 'true' },
  });

  console.log('\nDone. The server resolves these prices by lookup key automatically.');
  console.log('Optionally pin them via env vars to skip the lookup:');
  console.log(`  STRIPE_BASE_PRICE_ID=${basePrice.id}`);
  console.log(`  STRIPE_SEAT_PRICE_ID=${seatPrice.id}`);
  console.log('\nRemember to also set STRIPE_WEBHOOK_SECRET from your webhook endpoint settings');
  console.log('(endpoint URL: <APP_URL>/api/stripe/webhook, events: checkout.session.completed,');
  console.log(' customer.subscription.*, invoice.payment_failed).');
}

seedProducts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error seeding products:', err);
    process.exit(1);
  });
