import { db } from "../db";
import { 
  integrations, webhooks, automations, automationLogs, webhookLogs, analyticsEvents,
  type Integration, type InsertIntegration,
  type Webhook, type InsertWebhook,
  type Automation, type InsertAutomation,
  type AutomationLog, type InsertAutomationLog,
  type WebhookLog, type AnalyticsEvent, type InsertAnalyticsEvent
} from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import crypto from "crypto";

export interface AutomationAction {
  type: string;
  config: Record<string, unknown>;
}

export interface TriggerContext {
  workspaceId: number;
  userId?: string;
  guideId?: number;
  stepId?: number;
  data?: Record<string, unknown>;
}

class IntegrationsService {
  // === INTEGRATIONS ===
  
  async createIntegration(data: InsertIntegration): Promise<Integration> {
    const [integration] = await db.insert(integrations).values(data).returning();
    return integration;
  }

  async getIntegration(id: number): Promise<Integration | undefined> {
    const [integration] = await db.select().from(integrations).where(eq(integrations.id, id));
    return integration;
  }

  async getIntegrationsByWorkspace(workspaceId: number): Promise<Integration[]> {
    return db.select().from(integrations)
      .where(eq(integrations.workspaceId, workspaceId))
      .orderBy(desc(integrations.createdAt));
  }

  async updateIntegration(id: number, data: Partial<InsertIntegration>): Promise<Integration> {
    const [integration] = await db.update(integrations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(integrations.id, id))
      .returning();
    return integration;
  }

  async deleteIntegration(id: number): Promise<void> {
    await db.delete(integrations).where(eq(integrations.id, id));
  }

  async updateIntegrationStatus(id: number, status: "active" | "inactive" | "error", errorMessage?: string): Promise<void> {
    await db.update(integrations)
      .set({ status, errorMessage, updatedAt: new Date() })
      .where(eq(integrations.id, id));
  }

  // === WEBHOOKS ===

  async createWebhook(data: InsertWebhook): Promise<Webhook> {
    const secret = crypto.randomBytes(32).toString('hex');
    const [webhook] = await db.insert(webhooks).values({ ...data, secret }).returning();
    return webhook;
  }

  async getWebhook(id: number): Promise<Webhook | undefined> {
    const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, id));
    return webhook;
  }

  async getWebhooksByWorkspace(workspaceId: number): Promise<Webhook[]> {
    return db.select().from(webhooks)
      .where(eq(webhooks.workspaceId, workspaceId))
      .orderBy(desc(webhooks.createdAt));
  }

  async getActiveWebhooksForEvent(workspaceId: number, event: string): Promise<Webhook[]> {
    const allWebhooks = await db.select().from(webhooks)
      .where(and(
        eq(webhooks.workspaceId, workspaceId),
        eq(webhooks.isActive, true)
      ));
    return allWebhooks.filter(w => w.events.includes(event));
  }

  async updateWebhook(id: number, data: Partial<InsertWebhook>): Promise<Webhook> {
    const [webhook] = await db.update(webhooks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(webhooks.id, id))
      .returning();
    return webhook;
  }

  async deleteWebhook(id: number): Promise<void> {
    await db.delete(webhookLogs).where(eq(webhookLogs.webhookId, id));
    await db.delete(webhooks).where(eq(webhooks.id, id));
  }

  async triggerWebhook(webhook: Webhook, event: string, payload: Record<string, unknown>): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const signature = this.signPayload(JSON.stringify(payload), webhook.secret || '');
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
        ...(webhook.headers as Record<string, string> || {})
      };

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const executionTime = Date.now() - startTime;
      const responseBody = await response.text().catch(() => '');

      await db.insert(webhookLogs).values({
        webhookId: webhook.id,
        event,
        payload,
        statusCode: response.status,
        responseBody: responseBody.substring(0, 1000),
        success: response.ok,
        executionTimeMs: executionTime
      });

      if (response.ok) {
        await db.update(webhooks)
          .set({ lastTriggeredAt: new Date(), failureCount: 0 })
          .where(eq(webhooks.id, webhook.id));
      } else {
        await db.update(webhooks)
          .set({ failureCount: (webhook.failureCount || 0) + 1 })
          .where(eq(webhooks.id, webhook.id));
      }

      return response.ok;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      await db.insert(webhookLogs).values({
        webhookId: webhook.id,
        event,
        payload,
        statusCode: 0,
        responseBody: error instanceof Error ? error.message : 'Unknown error',
        success: false,
        executionTimeMs: executionTime
      });

      await db.update(webhooks)
        .set({ failureCount: (webhook.failureCount || 0) + 1 })
        .where(eq(webhooks.id, webhook.id));

      return false;
    }
  }

  private signPayload(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  // === AUTOMATIONS ===

  async createAutomation(data: InsertAutomation): Promise<Automation> {
    const [automation] = await db.insert(automations).values(data).returning();
    return automation;
  }

  async getAutomation(id: number): Promise<Automation | undefined> {
    const [automation] = await db.select().from(automations).where(eq(automations.id, id));
    return automation;
  }

  async getAutomationsByWorkspace(workspaceId: number): Promise<Automation[]> {
    return db.select().from(automations)
      .where(eq(automations.workspaceId, workspaceId))
      .orderBy(desc(automations.createdAt));
  }

  async getActiveAutomationsForTrigger(workspaceId: number, trigger: string): Promise<Automation[]> {
    return db.select().from(automations)
      .where(and(
        eq(automations.workspaceId, workspaceId),
        eq(automations.trigger, trigger as any),
        eq(automations.isActive, true)
      ));
  }

  async updateAutomation(id: number, data: Partial<InsertAutomation>): Promise<Automation> {
    const [automation] = await db.update(automations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(automations.id, id))
      .returning();
    return automation;
  }

  async deleteAutomation(id: number): Promise<void> {
    await db.delete(automationLogs).where(eq(automationLogs.automationId, id));
    await db.delete(automations).where(eq(automations.id, id));
  }

  async executeAutomation(automation: Automation, context: TriggerContext): Promise<void> {
    const startTime = Date.now();
    const actionsExecuted: { action: string; success: boolean; result?: unknown; error?: string }[] = [];
    let overallStatus: 'success' | 'partial' | 'failed' = 'success';
    let errorMessage: string | undefined;

    try {
      const actions = automation.actions as AutomationAction[];
      
      for (const action of actions) {
        try {
          const result = await this.executeAction(action, context, automation);
          actionsExecuted.push({ action: action.type, success: true, result });
        } catch (error) {
          actionsExecuted.push({ 
            action: action.type, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          overallStatus = 'partial';
        }
      }

      if (actionsExecuted.every(a => !a.success)) {
        overallStatus = 'failed';
      }
    } catch (error) {
      overallStatus = 'failed';
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
    }

    const executionTime = Date.now() - startTime;

    await db.insert(automationLogs).values({
      automationId: automation.id,
      workspaceId: context.workspaceId,
      triggeredBy: context.userId,
      triggerEvent: automation.trigger,
      triggerData: context.data,
      actionsExecuted,
      status: overallStatus,
      errorMessage,
      executionTimeMs: executionTime
    });

    await db.update(automations)
      .set({ runCount: (automation.runCount || 0) + 1, lastRunAt: new Date() })
      .where(eq(automations.id, automation.id));
  }

  private async executeAction(
    action: AutomationAction, 
    context: TriggerContext,
    automation: Automation
  ): Promise<unknown> {
    switch (action.type) {
      case 'send_email':
        return this.executeEmailAction(action.config, context);
      case 'trigger_webhook':
        return this.executeWebhookAction(action.config, context);
      case 'notify_user':
        return this.executeNotifyAction(action.config, context);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async executeEmailAction(config: Record<string, unknown>, context: TriggerContext): Promise<void> {
    // Email sending will be handled by emailService
    console.log('[Automation] Email action:', config, context);
  }

  private async executeWebhookAction(config: Record<string, unknown>, context: TriggerContext): Promise<void> {
    const url = config.url as string;
    if (!url) throw new Error('Webhook URL is required');
    
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...context, timestamp: new Date().toISOString() })
    });
  }

  private async executeNotifyAction(config: Record<string, unknown>, context: TriggerContext): Promise<void> {
    // Internal notification will be created
    console.log('[Automation] Notify action:', config, context);
  }

  // === TRIGGER SYSTEM ===

  async trigger(event: string, context: TriggerContext): Promise<void> {
    // Get webhooks for this event
    const activeWebhooks = await this.getActiveWebhooksForEvent(context.workspaceId, event);
    for (const webhook of activeWebhooks) {
      this.triggerWebhook(webhook, event, { event, ...context }).catch(console.error);
    }

    // Get automations for this trigger
    const activeAutomations = await this.getActiveAutomationsForTrigger(context.workspaceId, event);
    for (const automation of activeAutomations) {
      this.executeAutomation(automation, context).catch(console.error);
    }
  }

  // === ANALYTICS ===

  async trackEvent(event: InsertAnalyticsEvent): Promise<void> {
    await db.insert(analyticsEvents).values(event);
  }

  async getAnalyticsEvents(
    workspaceId: number, 
    options?: { limit?: number; offset?: number; eventName?: string }
  ): Promise<AnalyticsEvent[]> {
    let query = db.select().from(analyticsEvents)
      .where(eq(analyticsEvents.workspaceId, workspaceId))
      .orderBy(desc(analyticsEvents.createdAt));
    
    if (options?.eventName) {
      query = db.select().from(analyticsEvents)
        .where(and(
          eq(analyticsEvents.workspaceId, workspaceId),
          eq(analyticsEvents.eventName, options.eventName)
        ))
        .orderBy(desc(analyticsEvents.createdAt));
    }
    
    return query.limit(options?.limit || 100).offset(options?.offset || 0);
  }

  async getAutomationLogs(automationId: number, limit = 50): Promise<AutomationLog[]> {
    return db.select().from(automationLogs)
      .where(eq(automationLogs.automationId, automationId))
      .orderBy(desc(automationLogs.createdAt))
      .limit(limit);
  }

  async getWebhookLogs(webhookId: number, limit = 50): Promise<WebhookLog[]> {
    return db.select().from(webhookLogs)
      .where(eq(webhookLogs.webhookId, webhookId))
      .orderBy(desc(webhookLogs.createdAt))
      .limit(limit);
  }
}

export const integrationsService = new IntegrationsService();
