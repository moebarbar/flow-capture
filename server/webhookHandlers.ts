import Stripe from 'stripe';
import { getStripe } from './stripeClient';
import { billingService } from './services/billingService';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// users.subscription_status enum: active | canceled | past_due | trialing | inactive
function mapLegacyStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    default:
      return 'inactive';
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error(
        'STRIPE_WEBHOOK_SECRET not configured — cannot verify webhook signatures. ' +
          'Copy the signing secret from the Stripe dashboard webhook endpoint settings.'
      );
    }

    const stripe = getStripe();
    // Throws on invalid signature — the route returns 400
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
          const subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await billingService.handleSubscriptionUpdated(subscription);
          await WebhookHandlers.syncLegacyUserFields(subscription);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await billingService.handleSubscriptionUpdated(subscription);
        await WebhookHandlers.syncLegacyUserFields(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await billingService.handleSubscriptionDeleted(subscription);
        await WebhookHandlers.syncLegacyUserFields(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          await billingService.handlePaymentFailed(customerId);
        }
        break;
      }

      default:
        // Not a subscription-relevant event — acknowledge and ignore
        break;
    }
  }

  // The users table carries duplicate subscription fields consumed by
  // /api/subscription and the admin console; keep them in sync.
  static async syncLegacyUserFields(subscription: Stripe.Subscription): Promise<void> {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;
    const isCanceled = subscription.status === 'canceled';

    await db
      .update(users)
      .set({
        stripeSubscriptionId: isCanceled ? null : subscription.id,
        subscriptionStatus: mapLegacyStatus(subscription.status) as any,
        updatedAt: new Date(),
      })
      .where(eq(users.stripeCustomerId, customerId));
  }
}
