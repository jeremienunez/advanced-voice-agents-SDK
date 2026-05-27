import { isGemini31LiveModel } from "./gemini-model.js";

export function buildThinkingConfig(model: string): Record<string, unknown> {
  if (isGemini31LiveModel(model)) {
    return { thinkingLevel: "minimal" };
  }
  return { thinkingBudget: 0 };
}
