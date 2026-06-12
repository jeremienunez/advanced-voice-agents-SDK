import type {
  VoiceAffect,
  VoiceAffectLabel,
} from "../../../sdk/types/browser-voice.js";

const AFFECT_LABELS: readonly VoiceAffectLabel[] = [
  "neutral",
  "smile",
  "concern",
  "surprise",
  "thinking",
];

/* The tool schema advertises intensity as optional, "Default to 0.6";
   models (Gemini live) do omit it on valid labels, and an implicit 0
   would render the expression invisible. */
const DEFAULT_INTENSITY = 0.6;

/** Coerces model-supplied side-channel arguments into a safe VoiceAffect:
    labels outside the closed set become neutral, intensity is clamped to
    [0,1], malformed payloads degrade to a harmless neutral/0. */
export function toAffect(args: Record<string, unknown>): VoiceAffect {
  const raw = typeof args.label === "string" ? args.label : "";
  const known = (AFFECT_LABELS as readonly string[]).includes(raw);
  const label = known ? (raw as VoiceAffectLabel) : "neutral";
  const parsed = known && args.intensity === undefined
    ? DEFAULT_INTENSITY
    : Number(args.intensity);
  const intensity = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0;
  return { label, intensity };
}
