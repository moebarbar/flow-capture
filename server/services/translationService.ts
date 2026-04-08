import { anthropic } from "../lib/anthropic";
import { db } from "../db";
import {
  guideTranslations,
  stepTranslations,
  guides,
  steps,
  SUPPORTED_LANGUAGES,
  type Guide,
  type Step,
  type GuideTranslation,
  type StepTranslation
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

function hashContent(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

export async function translateGuide(
  guideId: number, 
  targetLocale: string
): Promise<GuideTranslation | null> {
  try {
    const guide = await db.query.guides.findFirst({
      where: eq(guides.id, guideId)
    });

    if (!guide) return null;

    const sourceContent = `${guide.title || ''}|${guide.description || ''}`;
    const sourceHash = hashContent(sourceContent);

    const existing = await db.query.guideTranslations.findFirst({
      where: and(
        eq(guideTranslations.flowId, guideId),
        eq(guideTranslations.locale, targetLocale)
      )
    });

    if (existing && existing.sourceHash === sourceHash && existing.status === 'completed') {
      return existing;
    }

    if (existing) {
      await db.update(guideTranslations)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(guideTranslations.id, existing.id));
    } else {
      await db.insert(guideTranslations).values({
        flowId: guideId,
        locale: targetLocale,
        title: guide.title || 'Untitled',
        description: guide.description,
        status: 'processing',
        sourceHash
      });
    }

    const languageName = SUPPORTED_LANGUAGES.find(l => l.code === targetLocale)?.name || targetLocale;

    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: `You are a professional translator. Translate the following guide content to ${languageName}. Maintain the same tone and style. Return ONLY valid JSON with no extra text: { "title": "...", "description": "..." }`,
      messages: [
        {
          role: "user",
          content: `Title: ${guide.title}\nDescription: ${guide.description || 'No description'}`
        }
      ],
    });

    const content = completion.content[0].type === 'text' ? completion.content[0].text : null;
    const translated = content ? JSON.parse(content) : { title: guide.title, description: guide.description };

    const result = await db.update(guideTranslations)
      .set({
        title: translated.title,
        description: translated.description,
        status: 'completed',
        translatedAt: new Date(),
        sourceHash,
        aiModel: 'claude-sonnet-4-6',
        updatedAt: new Date()
      })
      .where(and(
        eq(guideTranslations.flowId, guideId),
        eq(guideTranslations.locale, targetLocale)
      ))
      .returning();

    return result[0] || null;
  } catch (error) {
    console.error(`Translation error for guide ${guideId} to ${targetLocale}:`, error);
    
    await db.update(guideTranslations)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(and(
        eq(guideTranslations.flowId, guideId),
        eq(guideTranslations.locale, targetLocale)
      ));
    
    return null;
  }
}

export async function translateStep(
  stepId: number,
  guideId: number,
  targetLocale: string
): Promise<StepTranslation | null> {
  try {
    const step = await db.query.steps.findFirst({
      where: eq(steps.id, stepId)
    });

    if (!step) return null;

    const sourceContent = `${step.title || ''}|${step.description || ''}`;
    const sourceHash = hashContent(sourceContent);

    const existing = await db.query.stepTranslations.findFirst({
      where: and(
        eq(stepTranslations.stepId, stepId),
        eq(stepTranslations.locale, targetLocale)
      )
    });

    if (existing && existing.sourceHash === sourceHash && existing.status === 'completed') {
      return existing;
    }

    if (existing) {
      await db.update(stepTranslations)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(stepTranslations.id, existing.id));
    } else {
      await db.insert(stepTranslations).values({
        stepId,
        flowId: guideId,
        locale: targetLocale,
        title: step.title,
        description: step.description,
        status: 'processing',
        sourceHash
      });
    }

    const languageName = SUPPORTED_LANGUAGES.find(l => l.code === targetLocale)?.name || targetLocale;

    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: `You are a professional translator. Translate the following step content to ${languageName}. Maintain the same tone and style. Return ONLY valid JSON with no extra text: { "title": "...", "description": "..." }`,
      messages: [
        {
          role: "user",
          content: `Title: ${step.title || 'No title'}\nDescription: ${step.description || 'No description'}`
        }
      ],
    });

    const content = completion.content[0].type === 'text' ? completion.content[0].text : null;
    const translated = content ? JSON.parse(content) : { title: step.title, description: step.description };

    const result = await db.update(stepTranslations)
      .set({
        title: translated.title,
        description: translated.description,
        status: 'completed',
        translatedAt: new Date(),
        sourceHash,
        updatedAt: new Date()
      })
      .where(and(
        eq(stepTranslations.stepId, stepId),
        eq(stepTranslations.locale, targetLocale)
      ))
      .returning();

    return result[0] || null;
  } catch (error) {
    console.error(`Translation error for step ${stepId} to ${targetLocale}:`, error);
    
    await db.update(stepTranslations)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(and(
        eq(stepTranslations.stepId, stepId),
        eq(stepTranslations.locale, targetLocale)
      ));
    
    return null;
  }
}

export async function translateGuideWithSteps(
  guideId: number,
  targetLocales: string[]
): Promise<{ success: boolean; translations: { locale: string; guideTranslation: GuideTranslation | null; stepTranslations: (StepTranslation | null)[] }[] }> {
  const stepsResult = await db.query.steps.findMany({
    where: eq(steps.flowId, guideId),
    orderBy: (steps, { asc }) => [asc(steps.order)]
  });

  const translations = await Promise.all(
    targetLocales.map(async (locale) => {
      const guideTranslation = await translateGuide(guideId, locale);
      const stepResults = await Promise.all(
        stepsResult.map(step => translateStep(step.id, guideId, locale))
      );
      return { locale, guideTranslation, stepTranslations: stepResults };
    })
  );

  const success = translations.every(t => t.guideTranslation !== null);
  return { success, translations };
}

export async function getGuideTranslations(guideId: number): Promise<GuideTranslation[]> {
  return db.query.guideTranslations.findMany({
    where: eq(guideTranslations.flowId, guideId)
  });
}

export async function getStepTranslations(guideId: number, locale: string): Promise<StepTranslation[]> {
  return db.query.stepTranslations.findMany({
    where: and(
      eq(stepTranslations.flowId, guideId),
      eq(stepTranslations.locale, locale)
    )
  });
}

export async function deleteGuideTranslations(guideId: number): Promise<void> {
  await db.delete(guideTranslations).where(eq(guideTranslations.flowId, guideId));
  await db.delete(stepTranslations).where(eq(stepTranslations.flowId, guideId));
}

export function getSupportedLanguages() {
  return SUPPORTED_LANGUAGES;
}

export function isValidLocale(locale: string): boolean {
  return SUPPORTED_LANGUAGES.some(l => l.code === locale);
}
