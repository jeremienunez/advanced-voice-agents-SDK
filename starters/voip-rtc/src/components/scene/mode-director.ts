/** Pure deck direction: each studio mode gets a backdrop signature
    (energy, anchor, hue lean, drift speed), eased so mode switches pan
    the deck instead of hard-cutting. All channels live in [0,1]. */

export interface DeckState {
  readonly energy: number;
  readonly anchorX: number;
  readonly anchorY: number;
  /** 0 = action hue (cyan), 1 = success hue (green). */
  readonly hue: number;
  readonly drift: number;
}

const DECK_TARGETS: Record<string, DeckState> = {
  command: { energy: 0.38, anchorX: 0.72, anchorY: 0.4, hue: 0, drift: 0.25 },
  builder: { energy: 0.26, anchorX: 0.8, anchorY: 0.45, hue: 0.15, drift: 0.2 },
  agents: { energy: 0.22, anchorX: 0.3, anchorY: 0.5, hue: 0.05, drift: 0.15 },
  rtc: { energy: 0.12, anchorX: 0.5, anchorY: 0.55, hue: 0, drift: 0.1 },
  environment: { energy: 0.52, anchorX: 0.5, anchorY: 0.42, hue: 0.3, drift: 0.3 },
};

const FALLBACK: DeckState = DECK_TARGETS.command;
const EASE_RATE = 0.035; /* ~700ms to settle at 60fps */

export function deckTargetFor(mode: string, intensity: number): DeckState {
  const base = DECK_TARGETS[mode] ?? FALLBACK;
  const boost = Math.min(Math.max(intensity, 0), 1);
  /* intensity (builder progress, rtc voice) warms the deck up, bounded */
  return { ...base, energy: Math.min(1, base.energy + boost * 0.3) };
}

export function easeDeck(current: DeckState, target: DeckState): DeckState {
  return {
    energy: current.energy + (target.energy - current.energy) * EASE_RATE,
    anchorX: current.anchorX + (target.anchorX - current.anchorX) * EASE_RATE,
    anchorY: current.anchorY + (target.anchorY - current.anchorY) * EASE_RATE,
    hue: current.hue + (target.hue - current.hue) * EASE_RATE,
    drift: current.drift + (target.drift - current.drift) * EASE_RATE,
  };
}
