import sharp from 'sharp';
import { db } from '../db';
import { redactionRegions, steps } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { anthropic, isAnthropicConfigured } from '../lib/anthropic';
import { models } from '../config';
import { parseModelJson } from '../lib/modelJson';
import { objectStorageService, isObjectStorageConfigured } from '../replit_integrations/object_storage/objectStorage';
import { safeFetch } from '../lib/ssrf';
import crypto from 'crypto';

interface DetectedRegion {
  x: number;      // percent of image width (0-100)
  y: number;      // percent of image height (0-100)
  width: number;  // percent of image width
  height: number; // percent of image height
  type: 'blur' | 'box' | 'pixelate';
  detectedType: string;
}

// Load a step screenshot into a Buffer regardless of how it's stored
// (inline data URL, /objects/ path, or absolute URL).
async function loadImageBuffer(imageUrl: string | null): Promise<Buffer | null> {
  if (!imageUrl) return null;
  try {
    if (imageUrl.startsWith('data:')) {
      const base64 = imageUrl.split(',')[1] || '';
      return Buffer.from(base64, 'base64');
    }
    if (imageUrl.startsWith('/objects/')) {
      if (!isObjectStorageConfigured()) return null;
      return await objectStorageService.readObjectBuffer(imageUrl);
    }
    const res = await safeFetch(imageUrl);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (e: any) {
    console.warn('[Redaction] Could not load image:', e.message);
    return null;
  }
}

export const redactionService = {
  // Vision-based detection: ask Claude to locate visible sensitive data and
  // return bounding boxes as percentages of the image dimensions.
  async detectSensitiveData(stepId: number, _guideId: number): Promise<DetectedRegion[]> {
    const step = await db.select().from(steps).where(eq(steps.id, stepId)).then(r => r[0]);
    if (!step) throw new Error('Step not found');
    if (!isAnthropicConfigured()) return [];

    const buffer = await loadImageBuffer(step.imageUrl);
    if (!buffer) return [];

    let mediaType = 'image/png';
    try {
      const meta = await sharp(buffer).metadata();
      if (meta.format === 'jpeg') mediaType = 'image/jpeg';
      else if (meta.format === 'webp') mediaType = 'image/webp';
    } catch { /* default png */ }

    try {
      const completion = await anthropic.messages.create({
        model: models.claudeVision,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType as any, data: buffer.toString('base64') },
            },
            {
              type: 'text',
              text:
                'Identify every region in this screenshot containing sensitive information ' +
                '(email addresses, phone numbers, physical addresses, personal names, credit-card ' +
                'numbers, SSNs, API keys/tokens, passwords, account numbers). Return ONLY a JSON ' +
                'array; each item: {"x":number,"y":number,"width":number,"height":number,"detectedType":string} ' +
                'where x,y,width,height are percentages (0-100) of the image dimensions bounding that region. ' +
                'Return [] if none.',
            },
          ],
        }],
      });

      const text = completion.content[0].type === 'text' ? completion.content[0].text : '[]';
      const parsed = parseModelJson<any>(text.trim().startsWith('[') ? `{"regions":${text}}` : text);
      const arr: any[] = Array.isArray(parsed) ? parsed : (parsed.regions || []);
      return arr
        .filter((r) => r && typeof r.x === 'number' && typeof r.width === 'number')
        .map((r) => ({
          x: Math.max(0, Math.min(100, r.x)),
          y: Math.max(0, Math.min(100, r.y)),
          width: Math.max(0, Math.min(100, r.width)),
          height: Math.max(0, Math.min(100, r.height)),
          type: 'blur' as const,
          detectedType: String(r.detectedType || 'sensitive'),
        }));
    } catch (e: any) {
      console.warn('[Redaction] Vision detection failed:', e.message);
      return [];
    }
  },

  /**
   * Burn enabled redaction regions into a derived image (real pixel destruction
   * via sharp) and store it. Returns the /objects path or data URL of the
   * redacted image, or null if there are no enabled regions. The result is
   * cached on step.metadata.redactedImageUrl (keyed by a hash of the regions).
   */
  async renderStepRedaction(stepId: number): Promise<string | null> {
    const step = await db.select().from(steps).where(eq(steps.id, stepId)).then(r => r[0]);
    if (!step || !step.imageUrl) return null;

    const regions = (await this.getRegionsByStep(stepId)).filter(r => r.isEnabled);
    const meta = (step.metadata as any) || {};

    // No enabled regions → drop any previously baked redaction
    if (regions.length === 0) {
      if (meta.redactedImageUrl) {
        await db.update(steps).set({ metadata: { ...meta, redactedImageUrl: null, redactionHash: null } }).where(eq(steps.id, stepId));
      }
      return null;
    }

    // Skip re-render if the regions haven't changed since last bake
    const hash = crypto.createHash('md5')
      .update(JSON.stringify(regions.map(r => [r.x, r.y, r.width, r.height, r.type])))
      .digest('hex');
    if (meta.redactionHash === hash && meta.redactedImageUrl) {
      return meta.redactedImageUrl;
    }

    const buffer = await loadImageBuffer(step.imageUrl);
    if (!buffer) return null;

    const base = sharp(buffer);
    const { width = 0, height = 0 } = await base.metadata();
    if (!width || !height) return null;

    const composites: sharp.OverlayOptions[] = [];
    for (const r of regions) {
      const left = Math.max(0, Math.min(width - 1, Math.round((r.x / 100) * width)));
      const top = Math.max(0, Math.min(height - 1, Math.round((r.y / 100) * height)));
      const w = Math.max(1, Math.min(width - left, Math.round((r.width / 100) * width)));
      const h = Math.max(1, Math.min(height - top, Math.round((r.height / 100) * height)));

      if (r.type === 'box') {
        composites.push({
          input: { create: { width: w, height: h, channels: 4, background: { r: 17, g: 17, b: 17, alpha: 1 } } },
          left, top,
        });
      } else if (r.type === 'pixelate') {
        const small = Math.max(1, Math.round(Math.min(w, h) / 12));
        const patch = await sharp(buffer).extract({ left, top, width: w, height: h })
          .resize(small, small, { fit: 'fill' })
          .resize(w, h, { kernel: 'nearest' })
          .toBuffer();
        composites.push({ input: patch, left, top });
      } else {
        // blur (default)
        const patch = await sharp(buffer).extract({ left, top, width: w, height: h })
          .blur(Math.max(8, Math.round(Math.min(w, h) / 4)))
          .toBuffer();
        composites.push({ input: patch, left, top });
      }
    }

    const outBuffer = await sharp(buffer).composite(composites).png().toBuffer();

    // Persist the derived image (bucket if configured, else inline data URL)
    let redactedUrl: string;
    if (isObjectStorageConfigured()) {
      try {
        redactedUrl = await objectStorageService.saveObject(
          `redacted/step-${stepId}-${hash}.png`, outBuffer, 'image/png'
        );
      } catch {
        redactedUrl = `data:image/png;base64,${outBuffer.toString('base64')}`;
      }
    } else {
      redactedUrl = `data:image/png;base64,${outBuffer.toString('base64')}`;
    }

    await db.update(steps)
      .set({ metadata: { ...meta, redactedImageUrl: redactedUrl, redactionHash: hash } })
      .where(eq(steps.id, stepId));

    return redactedUrl;
  },

  async autoDetectAndSave(stepId: number, guideId: number): Promise<typeof redactionRegions.$inferSelect[]> {
    const detected = await this.detectSensitiveData(stepId, guideId);
    
    const savedRegions: typeof redactionRegions.$inferSelect[] = [];
    
    for (const region of detected) {
      const [saved] = await db.insert(redactionRegions).values({
        stepId,
        flowId: guideId,
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

    await this.renderStepRedaction(stepId).catch(() => {});
    return savedRegions;
  },

  async getRegion(id: number): Promise<typeof redactionRegions.$inferSelect | undefined> {
    const [region] = await db.select().from(redactionRegions).where(eq(redactionRegions.id, id));
    return region;
  },

  async getRegionsByStep(stepId: number): Promise<typeof redactionRegions.$inferSelect[]> {
    return db.select()
      .from(redactionRegions)
      .where(eq(redactionRegions.stepId, stepId));
  },

  async getRegionsByGuide(guideId: number): Promise<typeof redactionRegions.$inferSelect[]> {
    return db.select()
      .from(redactionRegions)
      .where(eq(redactionRegions.flowId, guideId));
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
      stepId: region.stepId,
      flowId: region.guideId,
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      type: region.type || 'blur',
      detectedType: region.detectedType,
      isAutoDetected: false,
      isEnabled: true,
    }).returning();
    await this.renderStepRedaction(region.stepId).catch(() => {});
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
    if (updated) await this.renderStepRedaction(updated.stepId).catch(() => {});
    return updated;
  },

  async deleteRegion(id: number): Promise<void> {
    const [region] = await db.select().from(redactionRegions).where(eq(redactionRegions.id, id));
    await db.delete(redactionRegions).where(eq(redactionRegions.id, id));
    if (region) await this.renderStepRedaction(region.stepId).catch(() => {});
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
    if (updated) await this.renderStepRedaction(updated.stepId).catch(() => {});
    return updated;
  },
};
