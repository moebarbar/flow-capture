import { anthropic } from "../lib/anthropic";
import { db } from "../db";
import { steps } from "@shared/schema";
import { eq } from "drizzle-orm";

interface StepContext {
  actionType: string;
  selector?: string | null;
  url?: string | null;
  elementText?: string | null;
  elementTag?: string | null;
  elementRole?: string | null;
  ariaLabel?: string | null;
  placeholder?: string | null;
  inputValue?: string | null;
  pageTitle?: string | null;
}

interface VisionAnalysis {
  title: string;
  description: string;
  appName: string | null;
  intent: string;
  isSignificant: boolean;
}

/**
 * Fetch an image URL and convert to base64 for Claude Vision.
 * Returns null if fetch fails.
 */
async function fetchImageAsBase64(imageUrl: string, appBaseUrl: string): Promise<string | null> {
  try {
    const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${appBaseUrl}${imageUrl}`;
    const response = await fetch(fullUrl);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  } catch {
    return null;
  }
}

/**
 * Analyze a step screenshot with Claude Vision to produce intelligent title/description.
 * Runs asynchronously after step creation — does NOT block the response.
 */
export async function analyzeStepWithVision(
  stepId: number,
  imageUrl: string,
  context: StepContext,
  appBaseUrl: string
): Promise<void> {
  try {
    const base64 = await fetchImageAsBase64(imageUrl, appBaseUrl);
    if (!base64) {
      console.warn(`[VisionService] Could not fetch image for step ${stepId}`);
      return;
    }

    // Build rich context string for Claude
    const contextLines: string[] = [];
    if (context.url) contextLines.push(`Page URL: ${context.url}`);
    if (context.pageTitle) contextLines.push(`Page title: ${context.pageTitle}`);
    if (context.actionType) contextLines.push(`Action: ${context.actionType}`);
    if (context.elementText) contextLines.push(`Element text: "${context.elementText}"`);
    if (context.ariaLabel) contextLines.push(`Aria label: "${context.ariaLabel}"`);
    if (context.placeholder) contextLines.push(`Placeholder: "${context.placeholder}"`);
    if (context.elementTag) contextLines.push(`Element tag: ${context.elementTag}`);
    if (context.elementRole) contextLines.push(`Element role: ${context.elementRole}`);
    if (context.inputValue) contextLines.push(`Input value: "${context.inputValue}"`);
    if (context.selector) contextLines.push(`Selector: ${context.selector}`);

    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: `You are an expert at analyzing UI screenshots to create workflow documentation.

Your job is to look at a screenshot and the captured metadata, then produce a clear, human-readable step description that would appear in a step-by-step guide (like Tango or Scribe).

Rules:
1. Look at what is VISIBLE in the screenshot — identify the app, the UI context, and what the user just did
2. Use the element metadata to confirm what was clicked/typed — but trust the screenshot over the metadata
3. Write a title that is short (max 8 words), starts with an action verb, uses the real UI label if visible
4. Write a description that is 1-2 sentences explaining what the user did and why it matters in the workflow
5. Identify the app or product name if visible (Salesforce, Shopify, Gmail, etc.)
6. Assess if this step is significant (not a trivial scroll or hover)

Return ONLY valid JSON — no markdown, no extra text:
{
  "title": "...",
  "description": "...",
  "appName": "..." or null,
  "intent": "one sentence describing the user's goal in this step",
  "isSignificant": true or false
}`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: base64,
              },
            },
            {
              type: "text",
              text: `Analyze this screenshot and the captured metadata below to describe what the user just did.\n\n${contextLines.join('\n')}`,
            },
          ],
        },
      ],
    });

    const raw = completion.content[0].type === "text" ? completion.content[0].text.trim() : null;
    if (!raw) return;

    let analysis: VisionAnalysis;
    try {
      // Strip markdown code fences if present
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.warn(`[VisionService] Failed to parse Claude response for step ${stepId}:`, raw);
      return;
    }

    // Update the step with the enriched data
    await db.update(steps)
      .set({
        title: analysis.title,
        description: analysis.description,
        metadata: {
          appName: analysis.appName,
          intent: analysis.intent,
          isSignificant: analysis.isSignificant,
          visionAnalyzed: true,
        } as any,
      })
      .where(eq(steps.id, stepId));

    console.log(`[VisionService] Step ${stepId} enriched: "${analysis.title}"`);
  } catch (err) {
    console.error(`[VisionService] Vision analysis failed for step ${stepId}:`, err);
    // Fail silently — step already saved with basic metadata
  }
}
