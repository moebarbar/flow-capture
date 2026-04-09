import { anthropic } from "../lib/anthropic";
import { db } from "../db";
import { steps, guides } from "@shared/schema";
import { eq, asc } from "drizzle-orm";

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
  associatedLabel?: string | null;
  nearestHeading?: string | null;
  pageSection?: string | null;
  formContext?: string | null;
  isDragDrop?: boolean;
  isFileUpload?: boolean;
  isPaste?: boolean;
  isRightClick?: boolean;
  isFormSubmit?: boolean;
  domChange?: { type: string; label: string } | null;
  fileNames?: string | null;
  pastedTextPreview?: string | null;
}

interface VisionAnalysis {
  title: string;
  description: string;
  appName: string | null;
  intent: string;
  isSignificant: boolean;
  stepType: string;
}

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
 * Analyze a step screenshot with Claude Vision.
 * Passes previous step titles for workflow chain context.
 * Runs asynchronously after step creation — does NOT block the response.
 */
export async function analyzeStepWithVision(
  stepId: number,
  imageUrl: string,
  context: StepContext,
  appBaseUrl: string,
  previousStepTitles?: string[]
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
    if (context.actionType) contextLines.push(`Action type: ${context.actionType}`);
    if (context.elementText) contextLines.push(`Element text: "${context.elementText}"`);
    if (context.associatedLabel) contextLines.push(`Field label: "${context.associatedLabel}"`);
    if (context.ariaLabel) contextLines.push(`Aria label: "${context.ariaLabel}"`);
    if (context.placeholder) contextLines.push(`Placeholder: "${context.placeholder}"`);
    if (context.elementTag) contextLines.push(`Element tag: ${context.elementTag}`);
    if (context.elementRole) contextLines.push(`Element role: ${context.elementRole}`);
    if (context.inputValue) contextLines.push(`Input value: "${context.inputValue}"`);
    if (context.nearestHeading) contextLines.push(`Nearest heading: "${context.nearestHeading}"`);
    if (context.pageSection) contextLines.push(`Page section: ${context.pageSection}`);
    if (context.formContext) contextLines.push(`Form: "${context.formContext}"`);
    if (context.selector) contextLines.push(`Selector: ${context.selector}`);

    // Special action hints
    if (context.isDragDrop) contextLines.push(`Special: This is a drag-and-drop action`);
    if (context.isFileUpload) contextLines.push(`Special: User is uploading file(s): ${context.fileNames}`);
    if (context.isPaste) contextLines.push(`Special: User pasted text: "${context.pastedTextPreview}"`);
    if (context.isRightClick) contextLines.push(`Special: User right-clicked to open context menu`);
    if (context.isFormSubmit) contextLines.push(`Special: User submitted a form`);
    if (context.domChange) contextLines.push(`Special: A ${context.domChange.type} appeared after this action: "${context.domChange.label}"`);

    // Previous steps in the workflow for chain understanding
    const workflowContext = previousStepTitles && previousStepTitles.length > 0
      ? `\n\nWorkflow so far (previous steps):\n${previousStepTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
      : '';

    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: `You are an expert UI analyst creating workflow documentation (like Tango or Scribe).

Look at the screenshot and metadata. Understand EXACTLY what the user did and WHY it matters in the workflow.

Rules:
1. Look at the ACTUAL screenshot — identify the app, page context, and what was interacted with
2. Use visible UI text (button labels, field names, headings) over raw selectors
3. Title: max 8 words, starts with action verb, uses real UI label if visible
4. Description: 1-2 sentences, explains what was done and its purpose in the workflow
5. stepType: classify as one of: click, input, navigation, upload, drag-drop, paste, form-submit, context-menu, keyboard, scroll, modal-open, notification, selection
6. isSignificant: false only for trivial scrolls with no new content visible, or accidental double-clicks
7. appName: identify the web app if visible (e.g. "Salesforce", "Shopify", "Notion", "Gmail")

If the screenshot shows a modal/dialog opened, describe the opening. If it shows a notification, describe what it says.

Return ONLY valid JSON — no markdown, no code fences:
{
  "title": "...",
  "description": "...",
  "appName": "..." or null,
  "intent": "one sentence: what is the user trying to accomplish in this step",
  "isSignificant": true or false,
  "stepType": "..."
}`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/png", data: base64 },
            },
            {
              type: "text",
              text: `Analyze this screenshot and describe what the user just did.\n\nCaptured metadata:\n${contextLines.join('\n')}${workflowContext}`,
            },
          ],
        },
      ],
    });

    const raw = completion.content[0].type === "text" ? completion.content[0].text.trim() : null;
    if (!raw) return;

    let analysis: VisionAnalysis;
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.warn(`[VisionService] Failed to parse Claude response for step ${stepId}:`, raw);
      return;
    }

    await db.update(steps)
      .set({
        title: analysis.title,
        description: analysis.description,
        metadata: {
          appName: analysis.appName,
          intent: analysis.intent,
          isSignificant: analysis.isSignificant,
          stepType: analysis.stepType,
          visionAnalyzed: true,
        } as any,
      })
      .where(eq(steps.id, stepId));

    console.log(`[VisionService] Step ${stepId} enriched: "${analysis.title}" (${analysis.stepType})`);
  } catch (err) {
    console.error(`[VisionService] Vision analysis failed for step ${stepId}:`, err);
  }
}
