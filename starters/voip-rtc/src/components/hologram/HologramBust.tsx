import { useEffect, useRef } from "react";
import { HoloRenderer, type HoloFrame } from "./holo-renderer.js";
import { getSharedFaceGeometry } from "./shared-geometry.js";
import "./styles/HologramBust.css";

/**
 * Ambient hologram bust for surfaces outside the RTC lab (previews,
 * dashboards). Renders the shared figure with a quiet breathing level;
 * pass `level`/`mood` to make it react.
 */
export function HologramBust({
  level = 0,
  mood = 0,
  presence = 1,
}: {
  level?: number;
  mood?: HoloFrame["mood"];
  /** 0..1 — scattered cloud at 0, fully assembled figure at 1. */
  presence?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef({ level, mood, presence });

  useEffect(() => {
    inputRef.current = { level, mood, presence };
  }, [level, mood, presence]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const renderer = new HoloRenderer(canvas, getSharedFaceGeometry(), () => {});
    if (!renderer.available) return undefined;

    let frameId = 0;
    let smoothedPresence = inputRef.current.presence;
    const animate = (stamp: number) => {
      const ambient = 0.05 + 0.035 * Math.sin(stamp * 0.0007);
      /* presence eases in: a completed step assembles the figure gently */
      smoothedPresence += (inputRef.current.presence - smoothedPresence) * 0.03;
      renderer.render({
        timeMs: stamp,
        level: Math.max(inputRef.current.level, ambient),
        mood: inputRef.current.mood,
        presence: smoothedPresence,
      });
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return <canvas ref={canvasRef} className="hologramBustCanvas" aria-hidden="true" />;
}
