/**
 * Message Content — normalize LangChain/OpenAI content blocks into plain text.
 *
 * Responses API may return arrays/objects instead of raw strings, especially
 * with reasoning/text blocks. This helper extracts only textual payloads.
 */

const DIRECT_TEXT_KEYS = [
  "text",
  "delta",
  "value",
  "output_text",
  "input_text",
] as const;

const NESTED_TEXT_KEYS = ["content", "reasoning", "summary"] as const;

export function extractMessageText(content: unknown): string {
  if (content == null) return "";

  if (typeof content === "string") return content;
  if (typeof content === "number" || typeof content === "boolean") {
    return String(content);
  }

  if (Array.isArray(content)) {
    return content.map((item) => extractMessageText(item)).join("");
  }

  if (typeof content !== "object") return "";

  const record = content as Record<string, unknown>;

  for (const key of DIRECT_TEXT_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
    if (value && typeof value === "object") {
      const nested = extractMessageText(value);
      if (nested) return nested;
    }
  }

  for (const key of NESTED_TEXT_KEYS) {
    const nested = extractMessageText(record[key]);
    if (nested) return nested;
  }

  return "";
}
