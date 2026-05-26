import type { BargeInHandlerConfig } from "./types.js";

export const URGENCY_PATTERNS = [
  /^(non|stop|attendez|arrêtez|pardon)/i,
  /^(euh\s+)?non\b/i,
  /^(mais|en fait)/i,
];

export const POLITE_PATTERNS = [
  /^(excusez-?moi|pardon|désolé)/i,
  /^(si je puis me permettre)/i,
  /^(j'aimerais|je voudrais)/i,
];

export const CORRECTION_PATTERNS = [
  /^(non,?\s+je|c'est pas|ce n'est pas)/i,
  /^(en fait|plutôt|finalement)/i,
];

export const SENSITIVITY_THRESHOLDS = {
  low: { minDuration: 300, confidence: 0.8 },
  medium: { minDuration: 150, confidence: 0.6 },
  high: { minDuration: 50, confidence: 0.4 },
} as const;

export const DEFAULT_CONFIG: Required<BargeInHandlerConfig> = {
  minSpeechDurationMs: 150,
  cooldownMs: 500,
  sensitivity: "medium",
  enableFrenchPatterns: true,
  debug: false,
};
