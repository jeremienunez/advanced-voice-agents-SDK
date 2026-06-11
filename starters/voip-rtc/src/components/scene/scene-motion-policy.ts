/** Reduced-motion policy for the WebGL layers. Today's CSS only softens
    aura transitions; this module is what actually stops the render loops:
    under prefers-reduced-motion the engine renders single static frames
    on state changes instead of running a continuous rAF loop. */

const STATIC_POSE_TIME_MS = 12_300; /* a calm mid-breath, eyes open pose */

export function prefersStaticMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Re-render once whenever the preference flips; returns an unsubscribe. */
export function watchMotionPreference(onChange: (reduced: boolean) => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  const listener = (event: MediaQueryListEvent) => onChange(event.matches);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

export function staticFrameTimeMs(): number {
  return STATIC_POSE_TIME_MS;
}

export function deckTransitionRate(reduced: boolean): number {
  return reduced ? 1 : 0.035;
}
