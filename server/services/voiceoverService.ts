import { db } from '../db';
import { stepVoiceovers, steps, guides } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { objectStorageClient } from '../replit_integrations/object_storage';

const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;
type Voice = typeof VOICES[number];

export class VoiceoverService {
  private getOpenAIClient() {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'https://api.openai.com/v1';
    
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    const OpenAI = require('openai').default;
    return new OpenAI({ apiKey, baseURL });
  }

  generateHash(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  async getVoiceover(stepId: number, locale: string = 'en') {
    const [voiceover] = await db.select()
      .from(stepVoiceovers)
      .where(and(
        eq(stepVoiceovers.stepId, stepId),
        eq(stepVoiceovers.locale, locale)
      ))
      .limit(1);
    return voiceover;
  }

  async getGuideVoiceovers(guideId: number, locale: string = 'en') {
    return await db.select()
      .from(stepVoiceovers)
      .where(and(
        eq(stepVoiceovers.guideId, guideId),
        eq(stepVoiceovers.locale, locale)
      ));
  }

  async generateVoiceover(
    stepId: number,
    guideId: number,
    text: string,
    voice: Voice = 'alloy',
    locale: string = 'en'
  ) {
    const sourceHash = this.generateHash(text);
    
    const existing = await this.getVoiceover(stepId, locale);
    if (existing && existing.sourceHash === sourceHash && existing.voice === voice && existing.status === 'completed') {
      return existing;
    }

    const voiceoverRecord = existing 
      ? await db.update(stepVoiceovers)
          .set({ 
            status: 'processing', 
            voice, 
            sourceText: text,
            sourceHash,
            errorMessage: null,
            updatedAt: new Date()
          })
          .where(eq(stepVoiceovers.id, existing.id))
          .returning()
          .then(r => r[0])
      : await db.insert(stepVoiceovers)
          .values({
            stepId,
            guideId,
            locale,
            voice,
            sourceText: text,
            sourceHash,
            status: 'processing'
          })
          .returning()
          .then(r => r[0]);

    try {
      const openai = this.getOpenAIClient();
      
      const response = await openai.audio.speech.create({
        model: 'tts-1',
        voice,
        input: text,
        response_format: 'mp3'
      });

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      
      const privateDir = process.env.PRIVATE_OBJECT_DIR;
      if (!privateDir) {
        throw new Error('Object storage not configured: PRIVATE_OBJECT_DIR environment variable is missing');
      }
      
      const bucketName = privateDir.split('/')[1];
      if (!bucketName) {
        throw new Error('Object storage not configured: Invalid PRIVATE_OBJECT_DIR format');
      }
      
      const objectPath = `${privateDir}/voiceovers/${guideId}/${stepId}_${locale}_${voice}_${Date.now()}.mp3`;
      const objectName = objectPath.split('/').slice(2).join('/');
      
      let audioUrl: string;
      try {
        const bucket = objectStorageClient.bucket(bucketName);
        const file = bucket.file(objectName);
        
        await file.save(audioBuffer, {
          contentType: 'audio/mpeg',
          metadata: {
            guideId: guideId.toString(),
            stepId: stepId.toString(),
            locale,
            voice
          }
        });

        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        
        audioUrl = signedUrl;
      } catch (storageError: any) {
        console.error('Object storage error:', storageError);
        throw new Error(`Failed to upload audio to object storage: ${storageError.message}`);
      }

      const durationEstimate = Math.ceil(text.length / 15);

      const [updated] = await db.update(stepVoiceovers)
        .set({
          audioUrl,
          duration: durationEstimate,
          status: 'completed',
          generatedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(stepVoiceovers.id, voiceoverRecord.id))
        .returning();

      return updated;
    } catch (error: any) {
      console.error('Voiceover generation error:', error);
      
      await db.update(stepVoiceovers)
        .set({
          status: 'failed',
          errorMessage: error.message || 'Failed to generate voiceover',
          updatedAt: new Date()
        })
        .where(eq(stepVoiceovers.id, voiceoverRecord.id));

      throw error;
    }
  }

  async generateGuideVoiceovers(guideId: number, voice: Voice = 'alloy', locale: string = 'en') {
    const guideSteps = await db.select()
      .from(steps)
      .where(eq(steps.guideId, guideId))
      .orderBy(steps.order);

    const results = [];
    
    for (const step of guideSteps) {
      const text = step.description || step.title || `Step ${step.order + 1}`;
      
      try {
        const voiceover = await this.generateVoiceover(step.id, guideId, text, voice, locale);
        results.push({ stepId: step.id, status: 'completed', voiceover });
      } catch (error: any) {
        results.push({ stepId: step.id, status: 'failed', error: error.message });
      }
    }

    return results;
  }

  async deleteVoiceover(stepId: number, locale: string = 'en') {
    await db.delete(stepVoiceovers)
      .where(and(
        eq(stepVoiceovers.stepId, stepId),
        eq(stepVoiceovers.locale, locale)
      ));
    return { success: true };
  }

  getAvailableVoices() {
    return VOICES.map(voice => ({
      id: voice,
      name: voice.charAt(0).toUpperCase() + voice.slice(1),
      description: this.getVoiceDescription(voice)
    }));
  }

  private getVoiceDescription(voice: Voice): string {
    const descriptions: Record<Voice, string> = {
      alloy: 'Neutral and balanced',
      echo: 'Warm and expressive',
      fable: 'Narrative and storytelling',
      onyx: 'Deep and authoritative',
      nova: 'Bright and conversational',
      shimmer: 'Clear and professional'
    };
    return descriptions[voice];
  }
}

export const voiceoverService = new VoiceoverService();
