import { db } from '../db';
import { redactionRegions, steps } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface DetectedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'blur' | 'box' | 'pixelate';
  detectedType: string;
}

const SENSITIVE_PATTERNS = [
  { name: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: 'phone', pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g },
  { name: 'ssn', pattern: /\d{3}[-.\s]?\d{2}[-.\s]?\d{4}/g },
  { name: 'credit_card', pattern: /\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}/g },
  { name: 'ip_address', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g },
  { name: 'api_key', pattern: /(?:api[_-]?key|apikey|secret|token)[=:\s]["']?[\w-]{20,}["']?/gi },
  { name: 'password', pattern: /(?:password|passwd|pwd)[=:\s]["']?[\w@#$%^&*!]{6,}["']?/gi },
];

export const redactionService = {
  async detectSensitiveData(stepId: number, guideId: number): Promise<DetectedRegion[]> {
    const step = await db.select().from(steps).where(eq(steps.id, stepId)).then(r => r[0]);
    if (!step) {
      throw new Error('Step not found');
    }

    const regions: DetectedRegion[] = [];

    if (step.description) {
      for (const { name, pattern } of SENSITIVE_PATTERNS) {
        const matches = step.description.match(pattern);
        if (matches && matches.length > 0) {
          regions.push({
            x: 10,
            y: 10,
            width: 30,
            height: 5,
            type: 'blur',
            detectedType: name,
          });
        }
      }
    }

    if (step.title) {
      for (const { name, pattern } of SENSITIVE_PATTERNS) {
        const matches = step.title.match(pattern);
        if (matches && matches.length > 0) {
          for (let i = 0; i < matches.length; i++) {
            regions.push({
              x: 10 + (i * 5) % 60,
              y: 20 + (i * 10) % 60,
              width: 25,
              height: 4,
              type: 'blur',
              detectedType: name,
            });
          }
        }
      }
    }

    return regions;
  },

  async autoDetectAndSave(stepId: number, guideId: number): Promise<typeof redactionRegions.$inferSelect[]> {
    const detected = await this.detectSensitiveData(stepId, guideId);
    
    const savedRegions: typeof redactionRegions.$inferSelect[] = [];
    
    for (const region of detected) {
      const [saved] = await db.insert(redactionRegions).values({
        stepId,
        guideId,
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        type: region.type,
        detectedType: region.detectedType,
        isAutoDetected: true,
        isEnabled: true,
      }).returning();
      savedRegions.push(saved);
    }

    return savedRegions;
  },

  async getRegionsByStep(stepId: number): Promise<typeof redactionRegions.$inferSelect[]> {
    return db.select()
      .from(redactionRegions)
      .where(eq(redactionRegions.stepId, stepId));
  },

  async getRegionsByGuide(guideId: number): Promise<typeof redactionRegions.$inferSelect[]> {
    return db.select()
      .from(redactionRegions)
      .where(eq(redactionRegions.guideId, guideId));
  },

  async createRegion(region: {
    stepId: number;
    guideId: number;
    x: number;
    y: number;
    width: number;
    height: number;
    type?: string;
    detectedType?: string;
  }): Promise<typeof redactionRegions.$inferSelect> {
    const [created] = await db.insert(redactionRegions).values({
      ...region,
      type: region.type || 'blur',
      isAutoDetected: false,
      isEnabled: true,
    }).returning();
    return created;
  },

  async updateRegion(id: number, update: Partial<{
    x: number;
    y: number;
    width: number;
    height: number;
    type: string;
    isEnabled: boolean;
  }>): Promise<typeof redactionRegions.$inferSelect> {
    const [updated] = await db.update(redactionRegions)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(redactionRegions.id, id))
      .returning();
    return updated;
  },

  async deleteRegion(id: number): Promise<void> {
    await db.delete(redactionRegions).where(eq(redactionRegions.id, id));
  },

  async deleteAllByStep(stepId: number): Promise<void> {
    await db.delete(redactionRegions).where(eq(redactionRegions.stepId, stepId));
  },

  async toggleRegion(id: number): Promise<typeof redactionRegions.$inferSelect> {
    const [region] = await db.select().from(redactionRegions).where(eq(redactionRegions.id, id));
    if (!region) {
      throw new Error('Region not found');
    }
    
    const [updated] = await db.update(redactionRegions)
      .set({ isEnabled: !region.isEnabled, updatedAt: new Date() })
      .where(eq(redactionRegions.id, id))
      .returning();
    return updated;
  },
};
