import { useEffect, useRef } from "react";
import { getSceneEngine } from "../scene/scene-engine.js";
import type { HoloFrame } from "./holo-figure.js";
import { createHoloView } from "./holo-points.js";
import "./styles/HologramBust.css";

/**
 * Ambient hologram bust for surfaces outside the RTC lab (previews,
 * dashboards). Registers a tracked view on the shared deck stage;
 * pass `level`/`mood` to make it react.
 */
export function HologramBust({
  level = 0,
  mood = 0,
  presence = 1,
  seed = 2002,
}: {
  level?: number;
  mood?: HoloFrame["mood"];
  /** 0..1 — scattered cloud at 0, fully assembled figure at 1. */
  presence?: number;
  /** Per-instance blink/idle seed so co-visible busts never sync. */
  seed?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef({ level, mood, presence });

  useEffect(() => {
    inputRef.current = { level, mood, presence };
  }, [level, mood, presence]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const engine = getSceneEngine();
    if (!engine.available) return undefined; /* silent fallback, as before */
    const view = createHoloView(seed);
    let smoothedPresence = inputRef.current.presence;
    const unregister = engine.registerView({
      element: host,
      draw(context) {
        const ambient = 0.05 + 0.035 * Math.sin(context.timeMs * 0.0007);
        /* presence eases in: a completed step assembles the figure gently */
        smoothedPresence += (inputRef.current.presence - smoothedPresence) * 0.03;
        view.draw(context, {
          timeMs: context.timeMs,
          level: Math.max(inputRef.current.level, ambient),
          mood: inputRef.current.mood,
          presence: smoothedPresence,
        });
      },
    });
    return () => {
      unregister();
      view.dispose();
    };
  }, []);

  return <div ref={hostRef} className="hologramBustCanvas" aria-hidden="true" />;
}
