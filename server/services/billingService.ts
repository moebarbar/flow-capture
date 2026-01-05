import { db } from '../db';
import { userSubscriptions, workspaceMembers, workspaceInvitations, users, workspaces } from '@shared/schema';
import { eq, and, count, sql } from 'drizzle-orm';
import { getUncachableStripeClient } from '../stripeClient';
import { stripeService } from '../stripeService';
import Stripe from 'stripe';

const STRIPE_BASE_PRICE = 2300;
const STRIPE_SEAT_PRICE = 700;

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

  async getProPriceIds(): Promise<{ basePriceId: string | null; seatPriceId: string | null }> {
    const result = await db.execute(sql`
      SELECT p.id as product_id, pr.id as price_id, pr.unit_amount, p.metadata
      FROM stripe.products p
      JOIN stripe.prices pr ON pr.product = p.id
      WHERE p.active = true AND pr.active = true
      ORDER BY pr.unit_amount ASC
    `);

    let basePriceId: string | null = null;
    let seatPriceId: string | null = null;

    for (const row of result.rows) {
      const r = row as any;
      if (r.unit_amount === STRIPE_BASE_PRICE) {
        basePriceId = r.price_id;
      } else if (r.unit_amount === STRIPE_SEAT_PRICE) {
        seatPriceId = r.price_id;
      }
    }

    return { basePriceId, seatPriceId };
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

  async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    const status = subscription.status as any;
    const baseItem = subscription.items.data[0];
    const sub = subscription as any;

    await this.createOrUpdateSubscription(userId, {
      stripeSubscriptionId: subscription.id,
      stripeBasePriceId: baseItem?.price.id,
      plan: 'pro',
      status,
      currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : undefined,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });
  }

  async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    await this.createOrUpdateSubscription(userId, {
      plan: 'free',
      status: 'canceled',
      stripeSubscriptionId: null,
      seatQuantity: 1
    });
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
