import { db } from '../db';
import { userSubscriptions, workspaceMembers, workspaceInvitations, users, workspaces } from '@shared/schema';
import { eq, and, count, sql } from 'drizzle-orm';
import { getUncachableStripeClient } from '../stripeClient';
import { stripeService } from '../stripeService';
import Stripe from 'stripe';

// Canonical pricing model: Pro = $23/mo base + $7/mo per additional seat
export const STRIPE_BASE_PRICE = 2300;
export const STRIPE_SEAT_PRICE = 700;

// Stable lookup keys used to resolve prices in Stripe (see scripts/seed-products.ts)
export const PRO_BASE_LOOKUP_KEY = 'flowcapture_pro_base';
export const PRO_SEAT_LOOKUP_KEY = 'flowcapture_pro_seat';

const PRICE_CACHE_TTL_MS = 5 * 60 * 1000;

type ProPriceIds = { basePriceId: string | null; seatPriceId: string | null };

export class BillingService {
  async getOrCreateStripeCustomer(userId: string, email: string, name?: string): Promise<string> {
    const existingSub = await db.select().from(userSubscriptions).where(eq(userSubscriptions.userId, userId)).limit(1);
    
    if (existingSub.length > 0 && existingSub[0].stripeCustomerId) {
      return existingSub[0].stripeCustomerId;
    }

    const customer = await stripeService.createCustomer(email, userId, name);
    return customer.id;
  }

  async getUserSubscription(userId: string) {
    const result = await db.select().from(userSubscriptions).where(eq(userSubscriptions.userId, userId)).limit(1);
    return result[0] || null;
  }

  async createOrUpdateSubscription(userId: string, data: Partial<typeof userSubscriptions.$inferInsert>) {
    const existing = await this.getUserSubscription(userId);
    
    if (existing) {
      await db.update(userSubscriptions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(userSubscriptions.userId, userId));
      return { ...existing, ...data };
    } else {
      const [result] = await db.insert(userSubscriptions)
        .values({ userId, ...data })
        .returning();
      return result;
    }
  }

  private proPriceCache: { value: ProPriceIds; expiresAt: number } | null = null;

  /**
   * Resolve the Pro base + seat price IDs.
   * Priority: explicit env vars → Stripe lookup keys → amount match (legacy accounts).
   */
  async getProPriceIds(): Promise<ProPriceIds> {
    if (process.env.STRIPE_BASE_PRICE_ID) {
      return {
        basePriceId: process.env.STRIPE_BASE_PRICE_ID,
        seatPriceId: process.env.STRIPE_SEAT_PRICE_ID || null,
      };
    }

    if (this.proPriceCache && this.proPriceCache.expiresAt > Date.now()) {
      return this.proPriceCache.value;
    }

    const stripe = await getUncachableStripeClient();
    let basePriceId: string | null = null;
    let seatPriceId: string | null = null;

    const byLookupKey = await stripe.prices.list({
      lookup_keys: [PRO_BASE_LOOKUP_KEY, PRO_SEAT_LOOKUP_KEY],
      active: true,
      limit: 10,
    });
    for (const price of byLookupKey.data) {
      if (price.lookup_key === PRO_BASE_LOOKUP_KEY) basePriceId = price.id;
      if (price.lookup_key === PRO_SEAT_LOOKUP_KEY) seatPriceId = price.id;
    }

    // Fallback for Stripe accounts seeded before lookup keys existed
    if (!basePriceId || !seatPriceId) {
      const allPrices = await stripe.prices.list({ active: true, limit: 100 });
      for (const price of allPrices.data) {
        if (price.recurring?.interval !== 'month') continue;
        if (!basePriceId && price.unit_amount === STRIPE_BASE_PRICE) basePriceId = price.id;
        if (!seatPriceId && price.unit_amount === STRIPE_SEAT_PRICE) seatPriceId = price.id;
      }
    }

    const value = { basePriceId, seatPriceId };
    this.proPriceCache = { value, expiresAt: Date.now() + PRICE_CACHE_TTL_MS };
    return value;
  }

  /** Find the app user a Stripe subscription belongs to. */
  private async resolveUserId(subscription: Stripe.Subscription): Promise<string | null> {
    if (subscription.metadata?.userId) return subscription.metadata.userId;

    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

    const [bySubscription] = await db
      .select({ userId: userSubscriptions.userId })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.stripeCustomerId, customerId))
      .limit(1);
    if (bySubscription) return bySubscription.userId;

    const [byUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);
    return byUser?.id ?? null;
  }

  async createProCheckoutSession(
    userId: string,
    email: string,
    successUrl: string,
    cancelUrl: string,
    additionalSeats: number = 0
  ) {
    const stripe = await getUncachableStripeClient();
    const customerId = await this.getOrCreateStripeCustomer(userId, email);
    
    const { basePriceId, seatPriceId } = await this.getProPriceIds();
    
    if (!basePriceId) {
      throw new Error('Pro plan base price not found. Please set up Stripe products first.');
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: basePriceId, quantity: 1 }
    ];

    if (additionalSeats > 0 && seatPriceId) {
      lineItems.push({ price: seatPriceId, quantity: additionalSeats });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata: {
        userId,
        additionalSeats: additionalSeats.toString()
      },
      subscription_data: {
        metadata: {
          userId,
          plan: 'pro'
        }
      }
    });

    await this.createOrUpdateSubscription(userId, {
      stripeCustomerId: customerId,
      plan: 'free',
      status: 'active'
    });

    return session;
  }

  async createBillingPortalSession(userId: string, returnUrl: string) {
    const subscription = await this.getUserSubscription(userId);
    
    if (!subscription?.stripeCustomerId) {
      throw new Error('No billing information found');
    }

    return await stripeService.createCustomerPortalSession(subscription.stripeCustomerId, returnUrl);
  }

  async updateSeatQuantity(userId: string, newSeatCount: number) {
    const stripe = await getUncachableStripeClient();
    const subscription = await this.getUserSubscription(userId);
    
    if (!subscription?.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    
    const { seatPriceId } = await this.getProPriceIds();
    
    if (!seatPriceId) {
      throw new Error('Seat price not configured');
    }

    const seatItem = stripeSubscription.items.data.find(
      item => item.price.id === seatPriceId || item.price.id === subscription.stripeSeatPriceId
    );

    const additionalSeats = Math.max(0, newSeatCount - 1);

    if (seatItem) {
      if (additionalSeats === 0) {
        await stripe.subscriptionItems.del(seatItem.id);
      } else {
        await stripe.subscriptionItems.update(seatItem.id, {
          quantity: additionalSeats
        });
      }
    } else if (additionalSeats > 0) {
      await stripe.subscriptionItems.create({
        subscription: subscription.stripeSubscriptionId,
        price: seatPriceId,
        quantity: additionalSeats
      });
    }

    await this.createOrUpdateSubscription(userId, {
      seatQuantity: newSeatCount,
      stripeSeatPriceId: seatPriceId
    });

    return { success: true, newSeatCount };
  }

  async countUserTotalMembers(userId: string): Promise<number> {
    const userWorkspaces = await db.select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.ownerId, userId));

    if (userWorkspaces.length === 0) {
      return 1;
    }

    const workspaceIds = userWorkspaces.map(w => w.id);
    
    const members = await db.select({ count: count() })
      .from(workspaceMembers)
      .where(sql`${workspaceMembers.workspaceId} IN (${sql.join(workspaceIds, sql`, `)})`);

    return members[0]?.count || 1;
  }

  // userSubscriptions.status enum: active | inactive | trialing | past_due | canceled | unpaid
  private mapSubscriptionStatus(status: Stripe.Subscription.Status): string {
    switch (status) {
      case 'active':
      case 'trialing':
      case 'past_due':
      case 'canceled':
      case 'unpaid':
        return status;
      default:
        // incomplete, incomplete_expired, paused
        return 'inactive';
    }
  }

  async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const userId = await this.resolveUserId(subscription);
    if (!userId) {
      console.warn(`Stripe webhook: no app user found for subscription ${subscription.id}`);
      return;
    }

    if (subscription.status === 'canceled') {
      return this.handleSubscriptionDeleted(subscription);
    }

    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

    const { basePriceId, seatPriceId } = await this.getProPriceIds()
      .catch(() => ({ basePriceId: null, seatPriceId: null } as ProPriceIds));

    const items = subscription.items.data;
    const baseItem = items.find((i) => i.price.id === basePriceId) ?? items[0];
    const seatItem = items.find(
      (i) =>
        i !== baseItem &&
        (i.price.id === seatPriceId || i.price.unit_amount === STRIPE_SEAT_PRICE)
    );
    const seatQuantity = 1 + (seatItem?.quantity ?? 0);

    const sub = subscription as any;

    await this.createOrUpdateSubscription(userId, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripeBasePriceId: baseItem?.price.id,
      stripeSeatPriceId: seatItem?.price.id ?? null,
      seatQuantity,
      plan: 'pro',
      status: this.mapSubscriptionStatus(subscription.status) as any,
      currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : undefined,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });
  }

  async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const userId = await this.resolveUserId(subscription);
    if (!userId) {
      console.warn(`Stripe webhook: no app user found for subscription ${subscription.id}`);
      return;
    }

    await this.createOrUpdateSubscription(userId, {
      plan: 'free',
      status: 'canceled',
      stripeSubscriptionId: null,
      seatQuantity: 1
    });
  }

  async handlePaymentFailed(customerId: string) {
    await db.update(userSubscriptions)
      .set({ status: 'past_due' as any, updatedAt: new Date() })
      .where(eq(userSubscriptions.stripeCustomerId, customerId));

    await db.update(users)
      .set({ subscriptionStatus: 'past_due' as any, updatedAt: new Date() })
      .where(eq(users.stripeCustomerId, customerId));
  }

  async getUserPlan(userId: string): Promise<{ plan: string; seatQuantity: number; limits: { maxWorkspaces: number; maxUsers: number } }> {
    const subscription = await this.getUserSubscription(userId);
    
    const plan = subscription?.plan || 'free';
    const seatQuantity = subscription?.seatQuantity || 1;
    
    return {
      plan,
      seatQuantity,
      limits: {
        maxWorkspaces: plan === 'free' ? 1 : Infinity,
        maxUsers: plan === 'free' ? 1 : seatQuantity
      }
    };
  }

  async canAddWorkspace(userId: string): Promise<boolean> {
    const { limits } = await this.getUserPlan(userId);
    
    if (limits.maxWorkspaces === Infinity) return true;
    
    const workspaceCount = await db.select({ count: count() })
      .from(workspaces)
      .where(eq(workspaces.ownerId, userId));
    
    return (workspaceCount[0]?.count || 0) < limits.maxWorkspaces;
  }

  async canAddMember(userId: string): Promise<{ allowed: boolean; requiresUpgrade: boolean; currentSeats: number; maxSeats: number }> {
    const { plan, seatQuantity } = await this.getUserPlan(userId);
    const currentMembers = await this.countUserTotalMembers(userId);
    
    if (plan === 'free') {
      return {
        allowed: currentMembers < 1,
        requiresUpgrade: true,
        currentSeats: currentMembers,
        maxSeats: 1
      };
    }
    
    return {
      allowed: currentMembers < seatQuantity,
      requiresUpgrade: false,
      currentSeats: currentMembers,
      maxSeats: seatQuantity
    };
  }
}

export const billingService = new BillingService();
