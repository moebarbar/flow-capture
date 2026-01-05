import { getStripeSync } from './stripeClient';
import { db } from './db';
import { users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  }

  static async handleSubscriptionChange(customerId: string, subscriptionId: string, status: string) {
    const subscriptionStatus = status === 'active' ? 'active' :
                               status === 'canceled' ? 'canceled' :
                               status === 'past_due' ? 'past_due' :
                               status === 'trialing' ? 'trialing' : 'inactive';

    await db.update(users)
      .set({ 
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: subscriptionStatus as any,
        updatedAt: new Date()
      })
      .where(eq(users.stripeCustomerId, customerId));
  }
}
