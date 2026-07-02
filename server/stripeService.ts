import { getStripe, isStripeConfigured } from './stripeClient';
import type Stripe from 'stripe';

/**
 * Live Stripe API access. Previously this read from a `stripe.*` Postgres
 * mirror schema populated by Replit's sync package; that mirror doesn't exist
 * outside Replit, so all reads now hit the Stripe API directly (with a short
 * cache on the hot product/price listing used by the pricing page).
 */

const LIST_CACHE_TTL_MS = 60 * 1000;

type ProductPriceRow = {
  product_id: string;
  product_name: string;
  product_description: string | null;
  product_active: boolean;
  product_metadata: Record<string, string>;
  price_id: string | null;
  unit_amount: number | null;
  currency: string | null;
  recurring: Stripe.Price.Recurring | null;
  price_active: boolean | null;
  price_metadata: Record<string, string> | null;
};

let productsWithPricesCache: { rows: ProductPriceRow[]; expiresAt: number } | null = null;

export class StripeService {
  async createCustomer(email: string, userId: string, name?: string) {
    return await getStripe().customers.create({
      email,
      name,
      metadata: { userId },
    });
  }

  async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    mode: 'subscription' | 'payment' = 'subscription'
  ) {
    return await getStripe().checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    });
  }

  async createCustomerPortalSession(customerId: string, returnUrl: string) {
    return await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async getProduct(productId: string) {
    try {
      return await getStripe().products.retrieve(productId);
    } catch {
      return null;
    }
  }

  async listProducts(active = true, limit = 20, _offset = 0) {
    if (!isStripeConfigured()) return [];
    const result = await getStripe().products.list({ active, limit: Math.min(limit, 100) });
    return result.data;
  }

  /**
   * Products joined with their active prices, in the flat row shape the
   * /api/products route and admin console expect.
   */
  async listProductsWithPrices(active = true, limit = 20, _offset = 0): Promise<ProductPriceRow[]> {
    if (!isStripeConfigured()) return [];

    if (productsWithPricesCache && productsWithPricesCache.expiresAt > Date.now()) {
      return productsWithPricesCache.rows;
    }

    const stripe = getStripe();
    const [products, prices] = await Promise.all([
      stripe.products.list({ active, limit: Math.min(Math.max(limit, 20), 100) }),
      stripe.prices.list({ active: true, limit: 100 }),
    ]);

    const rows: ProductPriceRow[] = [];
    for (const product of products.data) {
      const productPrices = prices.data
        .filter((price) => {
          const productId = typeof price.product === 'string' ? price.product : price.product.id;
          return productId === product.id;
        })
        .sort((a, b) => (a.unit_amount ?? 0) - (b.unit_amount ?? 0));

      if (productPrices.length === 0) {
        rows.push({
          product_id: product.id,
          product_name: product.name,
          product_description: product.description,
          product_active: product.active,
          product_metadata: product.metadata,
          price_id: null,
          unit_amount: null,
          currency: null,
          recurring: null,
          price_active: null,
          price_metadata: null,
        });
        continue;
      }

      for (const price of productPrices) {
        rows.push({
          product_id: product.id,
          product_name: product.name,
          product_description: product.description,
          product_active: product.active,
          product_metadata: product.metadata,
          price_id: price.id,
          unit_amount: price.unit_amount,
          currency: price.currency,
          recurring: price.recurring,
          price_active: price.active,
          price_metadata: price.metadata,
        });
      }
    }

    productsWithPricesCache = { rows, expiresAt: Date.now() + LIST_CACHE_TTL_MS };
    return rows;
  }

  async getPrice(priceId: string) {
    try {
      return await getStripe().prices.retrieve(priceId);
    } catch {
      return null;
    }
  }

  async listPrices(active = true, limit = 20, _offset = 0) {
    if (!isStripeConfigured()) return [];
    const result = await getStripe().prices.list({ active, limit: Math.min(limit, 100) });
    return result.data;
  }

  async getSubscription(subscriptionId: string) {
    try {
      return await getStripe().subscriptions.retrieve(subscriptionId);
    } catch {
      return null;
    }
  }

  async getCustomer(customerId: string) {
    try {
      return await getStripe().customers.retrieve(customerId);
    } catch {
      return null;
    }
  }

  async listSubscriptions(limit = 100, _offset = 0) {
    if (!isStripeConfigured()) return [];
    const result = await getStripe().subscriptions.list({
      status: 'all',
      limit: Math.min(limit, 100),
    });
    return result.data;
  }

  async listCustomers(limit = 100, _offset = 0) {
    if (!isStripeConfigured()) return [];
    const result = await getStripe().customers.list({ limit: Math.min(limit, 100) });
    return result.data;
  }

  async getPaymentIntents(limit = 100, _offset = 0) {
    if (!isStripeConfigured()) return [];
    const result = await getStripe().paymentIntents.list({ limit: Math.min(limit, 100) });
    return result.data;
  }

  async getInvoices(limit = 100, _offset = 0) {
    if (!isStripeConfigured()) return [];
    const result = await getStripe().invoices.list({ limit: Math.min(limit, 100) });
    return result.data;
  }

  // Create a new product in Stripe
  async createProduct(name: string, description?: string) {
    const product = await getStripe().products.create({
      name,
      description: description || undefined,
    });
    productsWithPricesCache = null;
    return product;
  }

  // Create a new price in Stripe
  async createPrice(productId: string, unitAmount: number, currency: string, interval: 'month' | 'year') {
    const price = await getStripe().prices.create({
      product: productId,
      unit_amount: unitAmount,
      currency,
      recurring: { interval },
    });
    productsWithPricesCache = null;
    return price;
  }

  async syncStripeData() {
    productsWithPricesCache = null;
    return { success: true, message: 'Using the live Stripe API — data is always current' };
  }
}

export const stripeService = new StripeService();
