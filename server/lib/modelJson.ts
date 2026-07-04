/**
 * Parse JSON out of an LLM text response. Models often wrap JSON in ```json
 * code fences or add prose around it; this strips fences and, as a fallback,
 * extracts the first balanced {...} object. Throws if nothing parses.
 */
export function parseModelJson<T = any>(text: string): T {
  const raw = (text || "").trim();

  // 1) Strip a surrounding code fence if present
  const unfenced = raw
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();

  try {
    return JSON.parse(unfenced) as T;
  } catch {
    // 2) Fall back to the first {...} slice
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(unfenced.slice(start, end + 1)) as T;
    }
    throw new Error("No valid JSON found in model response");
  }
}
