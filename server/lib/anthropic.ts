import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function isAnthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI features unavailable: ANTHROPIC_API_KEY is not set");
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// Lazy proxy so importing this module never crashes when the key is missing;
// the error surfaces only when an AI feature is actually used.
export const anthropic: Anthropic = new Proxy({} as Anthropic, {
  get(_target, prop) {
    const instance = getAnthropic();
    const value = (instance as any)[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
