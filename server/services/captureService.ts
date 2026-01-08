import { db } from "../db";
import { captureSessions, steps, guides } from "@shared/schema";
import { eq, and, gte } from "drizzle-orm";
import crypto from "crypto";
import { objectStorageClient } from "../replit_integrations/object_storage/objectStorage";

const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// Check if object storage is properly configured
function isObjectStorageConfigured(): boolean {
  return !!process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
}

// Helper to upload base64 image to object storage
async function uploadScreenshot(base64Data: string, guideId: number): Promise<string | null> {
  try {
    // Get bucket name from environment
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      console.warn('Object storage not configured - screenshots will not be saved');
      return null;
    }

    // Remove data URL prefix if present
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Content, 'base64');
    
    // Generate unique filename
    const filename = `captures/guide-${guideId}/${crypto.randomUUID()}.png`;
    
    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(filename);
    
    await file.save(buffer, {
      contentType: 'image/png',
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });
    
    console.log(`Screenshot uploaded: ${filename}`);
    // Return the object path that can be served via our objects endpoint
    return `/objects/${filename}`;
  } catch (e) {
    console.error('Failed to upload screenshot:', e);
    return null;
  }
}

export const captureService = {
  // Check if object storage is ready for capture
  isStorageReady(): boolean {
    return isObjectStorageConfigured();
  },

  async startSession(guideId: number, userId: string): Promise<typeof captureSessions.$inferSelect | { error: string }> {
    // Fail fast if object storage is not configured
    if (!isObjectStorageConfigured()) {
      console.error('Cannot start capture session - object storage not configured');
      return { error: 'Object storage is not configured. Please set up object storage before capturing.' };
    }

    // End any existing active sessions for this guide
    await db.update(captureSessions)
      .set({ status: "stopped", stoppedAt: new Date() })
      .where(and(
        eq(captureSessions.flowId, guideId),
        eq(captureSessions.status, "active")
      ));

    // Generate unique session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    const [session] = await db.insert(captureSessions).values({
      flowId: guideId,
      userId,
      token,
      status: "active",
      expiresAt,
    }).returning();

    return session;
  },

  async stopSession(guideId: number, userId: string): Promise<typeof captureSessions.$inferSelect | null> {
    const [session] = await db.update(captureSessions)
      .set({ status: "stopped", stoppedAt: new Date() })
      .where(and(
        eq(captureSessions.flowId, guideId),
        eq(captureSessions.userId, userId),
        eq(captureSessions.status, "active")
      ))
      .returning();

    return session || null;
  },

  async cancelSession(guideId: number, userId: string): Promise<{ deletedSteps: number } | null> {
    // Find the active session
    const [session] = await db.select()
      .from(captureSessions)
      .where(and(
        eq(captureSessions.flowId, guideId),
        eq(captureSessions.userId, userId),
        eq(captureSessions.status, "active")
      ));

    if (!session) return null;

    // Delete all steps created after the session started for this guide
    const stepsToDelete = await db.select()
      .from(steps)
      .where(and(
        eq(steps.flowId, guideId),
        gte(steps.createdAt, session.startedAt)
      ));

    // Delete screenshots from object storage
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (bucketId) {
      for (const step of stepsToDelete) {
        if (step.imageUrl && step.imageUrl.startsWith('/objects/')) {
          try {
            const objectPath = step.imageUrl.replace('/objects/', '');
            const bucket = objectStorageClient.bucket(bucketId);
            await bucket.file(objectPath).delete().catch(() => {});
          } catch (e) {
            console.warn('Failed to delete screenshot:', step.imageUrl);
          }
        }
      }
    }

    // Delete the steps
    await db.delete(steps)
      .where(and(
        eq(steps.flowId, guideId),
        gte(steps.createdAt, session.startedAt)
      ));

    // Mark session as cancelled
    await db.update(captureSessions)
      .set({ status: "stopped", stoppedAt: new Date() })
      .where(eq(captureSessions.id, session.id));

    // Reorder remaining steps to ensure sequential order
    const remainingSteps = await db.select()
      .from(steps)
      .where(eq(steps.flowId, guideId))
      .orderBy(steps.order);
    
    for (let i = 0; i < remainingSteps.length; i++) {
      if (remainingSteps[i].order !== i) {
        await db.update(steps)
          .set({ order: i })
          .where(eq(steps.id, remainingSteps[i].id));
      }
    }

    return { deletedSteps: stepsToDelete.length };
  },

  async getActiveSession(guideId: number): Promise<typeof captureSessions.$inferSelect | null> {
    const [session] = await db.select()
      .from(captureSessions)
      .where(and(
        eq(captureSessions.flowId, guideId),
        eq(captureSessions.status, "active")
      ));

    if (!session) return null;

    // Check if session expired
    if (new Date() > session.expiresAt) {
      await db.update(captureSessions)
        .set({ status: "expired" })
        .where(eq(captureSessions.id, session.id));
      return null;
    }

    return session;
  },

  async validateToken(token: string): Promise<typeof captureSessions.$inferSelect | null> {
    const [session] = await db.select()
      .from(captureSessions)
      .where(and(
        eq(captureSessions.token, token),
        eq(captureSessions.status, "active")
      ));

    if (!session) return null;

    // Check if expired
    if (new Date() > session.expiresAt) {
      await db.update(captureSessions)
        .set({ status: "expired" })
        .where(eq(captureSessions.id, session.id));
      return null;
    }

    // Verify the associated guide still exists
    const [guide] = await db.select().from(guides).where(eq(guides.id, session.flowId));
    if (!guide) {
      await db.update(captureSessions)
        .set({ status: "stopped" })
        .where(eq(captureSessions.id, session.id));
      return null;
    }

    return session;
  },

  async addCapturedStep(
    sessionToken: string,
    stepData: {
      title?: string;
      description?: string;
      imageData?: string; // Base64 screenshot
      actionType?: string;
      selector?: string;
      url?: string;
      metadata?: object;
    }
  ): Promise<typeof steps.$inferSelect | null> {
    const session = await this.validateToken(sessionToken);
    if (!session) return null;

    // Get current step count for order
    const existingSteps = await db.select()
      .from(steps)
      .where(eq(steps.flowId, session.flowId));

    const order = existingSteps.length;

    // Upload screenshot if provided
    let imageUrl: string | null = null;
    if (stepData.imageData) {
      imageUrl = await uploadScreenshot(stepData.imageData, session.flowId);
    }

    // Create step
    const [step] = await db.insert(steps).values({
      flowId: session.flowId,
      order,
      title: stepData.title || `Step ${order + 1}`,
      description: stepData.description || null,
      imageUrl,
      actionType: (stepData.actionType as any) || "click",
      selector: stepData.selector || null,
      url: stepData.url || null,
      metadata: stepData.metadata || null,
    }).returning();

    // Update session stats
    await db.update(captureSessions)
      .set({
        eventsReceived: session.eventsReceived + 1,
        lastEventAt: new Date(),
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS), // Extend session
      })
      .where(eq(captureSessions.id, session.id));

    // Update guide's updatedAt
    await db.update(guides)
      .set({ updatedAt: new Date() })
      .where(eq(guides.id, session.flowId));

    return step;
  },

  async processCapturedEvents(
    sessionToken: string,
    events: Array<{
      type: string;
      title?: string;
      description?: string;
      imageData?: string;
      selector?: string;
      url?: string;
      timestamp?: number;
      metadata?: object;
    }>
  ): Promise<typeof steps.$inferSelect[]> {
    const session = await this.validateToken(sessionToken);
    if (!session) return [];

    const createdSteps: typeof steps.$inferSelect[] = [];

    // Get current step count
    const existingSteps = await db.select()
      .from(steps)
      .where(eq(steps.flowId, session.flowId));

    let order = existingSteps.length;

    for (const event of events) {
      // Upload screenshot if provided
      let imageUrl: string | null = null;
      if (event.imageData) {
        imageUrl = await uploadScreenshot(event.imageData, session.flowId);
      }

      const [step] = await db.insert(steps).values({
        flowId: session.flowId,
        order: order++,
        title: event.title || `Step ${order}`,
        description: event.description || this.generateDescription(event),
        imageUrl,
        actionType: this.mapEventType(event.type),
        selector: event.selector || null,
        url: event.url || null,
        metadata: event.metadata || null,
      }).returning();

      createdSteps.push(step);
    }

    // Update session stats
    await db.update(captureSessions)
      .set({
        eventsReceived: session.eventsReceived + events.length,
        lastEventAt: new Date(),
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
      })
      .where(eq(captureSessions.id, session.id));

    // Update guide
    await db.update(guides)
      .set({ updatedAt: new Date() })
      .where(eq(guides.id, session.flowId));

    return createdSteps;
  },

  mapEventType(type: string): "click" | "input" | "navigation" | "wait" | "scroll" | "custom" {
    const mapping: Record<string, "click" | "input" | "navigation" | "wait" | "scroll" | "custom"> = {
      "click": "click",
      "input": "input",
      "change": "input",
      "navigate": "navigation",
      "scroll": "scroll",
      "keydown": "input",
      "submit": "click",
    };
    return mapping[type] || "custom";
  },

  generateDescription(event: { type: string; selector?: string; url?: string }): string {
    switch (event.type) {
      case "click":
        return `Click on ${event.selector || "element"}`;
      case "input":
        return `Enter text in ${event.selector || "field"}`;
      case "navigate":
        return `Navigate to ${event.url || "page"}`;
      case "scroll":
        return "Scroll the page";
      default:
        return `Perform ${event.type} action`;
    }
  },
};
