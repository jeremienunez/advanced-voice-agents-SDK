import type { GeminiRealtimeModel } from "../../types/gemini.types.js";

export const DEFAULT_GEMINI_LIVE_MODEL = "gemini-3.1-flash-live-preview";

export function normalizeGeminiModel(
  model?: GeminiRealtimeModel,
): string {
  const rawModel = model ?? DEFAULT_GEMINI_LIVE_MODEL;
  return rawModel.startsWith("models/") ? rawModel : `models/${rawModel}`;
}

export function isGemini31LiveModel(model: string): boolean {
  return model.includes("gemini-3.1-flash-live-preview");
}
