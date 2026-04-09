import { anthropic } from "../lib/anthropic";
import { db } from "../db";
import { steps, guides } from "@shared/schema";
import { eq, asc } from "drizzle-orm";

interface StepSummary {
  id: number;
  order: number;
  title: string | null;
  description: string | null;
  actionType: string;
  url: string | null;
  metadata: any;
}

interface IntelligenceResult {
  guideTitle: string;
  guideSummary: string;
  sections: { title: string; stepIds: number[] }[];
  trivialStepIds: number[];
  workflowGoal: string;
}

/**
 * After all steps are captured and vision-analyzed, run a guide-level intelligence pass:
 * - Generates a smart guide title based on what was actually done
 * - Identifies trivial/redundant steps to mark (not delete — user can review)
 * - Groups steps into logical sections
 * - Writes a workflow summary
 */
export async function runGuideIntelligence(guideId: number): Promise<void> {
  try {
    // Wait for vision analysis to settle (it's async background work)
    await new Promise(resolve => setTimeout(resolve, 3000));

    const allSteps = await db.select()
      .from(steps)
      .where(eq(steps.flowId, guideId))
      .orderBy(asc(steps.order));

    if (allSteps.length === 0) return;

    const guide = await db.select().from(guides).where(eq(guides.id, guideId)).limit(1);
    if (!guide[0]) return;

    // Build a compact step summary for Claude
    const stepSummaries: StepSummary[] = allSteps.map(s => ({
      id: s.id,
      order: s.order,
      title: s.title,
      description: s.description,
      actionType: s.actionType,
      url: s.url,
      metadata: s.metadata,
    }));

    const stepsText = stepSummaries.map(s => {
      const meta = (s.metadata as any) || {};
      return `Step ${s.order + 1} [id:${s.id}]: "${s.title || 'Untitled'}" — ${s.actionType} on ${s.url || 'page'}${meta.appName ? ` (${meta.appName})` : ''}${meta.intent ? ` | Intent: ${meta.intent}` : ''}`;
    }).join('\n');

    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system: `You are an expert technical writer analyzing a captured workflow to produce intelligent documentation.

Given a list of captured steps, you will:
1. Generate a concise guide title (5-10 words) that describes what the user accomplished — NOT just "Captured Workflow"
2. Write a 1-2 sentence guide summary describing the full workflow and its purpose
3. Write a workflow goal (1 sentence, starts with a verb: "Create...", "Configure...", "Submit...")
4. Group steps into 2-5 logical sections. Each section should have a clear title and contain related steps.
5. Identify trivial step IDs to flag (scrolls with no intent, accidental double-clicks, navigation steps that are just loading screens). Only flag steps that add no value to the documentation.

Return ONLY valid JSON — no markdown, no code fences:
{
  "guideTitle": "...",
  "guideSummary": "...",
  "workflowGoal": "...",
  "sections": [
    { "title": "...", "stepIds": [1, 2, 3] }
  ],
  "trivialStepIds": []
}`,
      messages: [
        {
          role: "user",
          content: `Analyze this captured workflow and produce intelligent documentation structure.\n\nCurrent guide title: "${guide[0].title}"\n\nCaptured steps:\n${stepsText}`,
        },
      ],
    });

    const raw = completion.content[0].type === "text" ? completion.content[0].text.trim() : null;
    if (!raw) return;

    let result: IntelligenceResult;
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      console.warn(`[GuideIntelligence] Failed to parse Claude response for guide ${guideId}:`, raw);
      return;
    }

    // Update guide title and description if the AI produced a better one
    const currentTitle = guide[0].title || '';
    const isGenericTitle = currentTitle.startsWith('Captured Workflow') ||
      currentTitle.startsWith('New Guide') ||
      currentTitle.trim() === '';

    await db.update(guides)
      .set({
        title: isGenericTitle ? result.guideTitle : currentTitle,
        description: result.guideSummary,
        updatedAt: new Date(),
      })
      .where(eq(guides.id, guideId));

    // Mark trivial steps in their metadata (soft flag — not deleted)
    if (result.trivialStepIds && result.trivialStepIds.length > 0) {
      for (const stepId of result.trivialStepIds) {
        const step = allSteps.find(s => s.id === stepId);
        if (!step) continue;
        const existingMeta = (step.metadata as any) || {};
        await db.update(steps)
          .set({
            metadata: { ...existingMeta, isTrivial: true } as any,
          })
          .where(eq(steps.id, stepId));
      }
    }

    console.log(`[GuideIntelligence] Guide ${guideId} analyzed: "${result.guideTitle}" — ${result.sections.length} sections, ${result.trivialStepIds?.length || 0} trivial steps flagged`);
  } catch (err) {
    console.error(`[GuideIntelligence] Analysis failed for guide ${guideId}:`, err);
  }
}
