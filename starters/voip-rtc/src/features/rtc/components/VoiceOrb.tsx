import { useEffect, useRef, useState, type CSSProperties } from "react";
import { gazeTarget } from "../../../components/hologram/holo-motion.js";
import { createRtcStageRenderer, syncRendererSize } from "./rtc-stage-renderer.js";
import { createRtcStageScene } from "./rtc-stage-scene.js";
import "../styles/components/VoiceOrb.css";

interface VoiceSignal {
  isListening: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  level: number;
}

export function VoiceOrb({
  state,
  isMuted,
  outputLevel,
}: {
  state: string;
  isMuted: boolean;
  outputLevel: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signalRef = useRef<VoiceSignal>({
    isListening: false,
    isMuted: false,
    isSpeaking: false,
    level: 0,
  });
  const [renderError, setRenderError] = useState<string | null>(null);
  const level = Math.min(1, Math.max(0, outputLevel));
  const isListening = state === "listening";
  const isSpeaking = state === "speaking";
  const visualLevel = isMuted ? 0 : Math.max(level, isListening ? 0.12 : 0);
  const orbStyle = {
    "--voice-level": visualLevel.toFixed(3),
    "--orb-scale": (0.98 + visualLevel * 0.09).toFixed(3),
    "--aura-opacity": (isMuted ? 0.18 : 0.32 + visualLevel * 0.42).toFixed(3),
    "--aura-scale": (0.94 + visualLevel * 0.18).toFixed(3),
    "--holo-blur": `${Math.round(44 + visualLevel * 52)}px`,
  } as CSSProperties;

  useEffect(() => {
    signalRef.current = { isListening, isMuted, isSpeaking, level };
  }, [isListening, isMuted, isSpeaking, level]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const renderer = createRtcStageRenderer(canvas);
    if (!renderer) {
      setRenderError("webgl unavailable");
      return undefined;
    }
    const stage = createRtcStageScene();

    let frameId = 0;
    let smoothedLevel = 0;
    const gaze = { x: 0, y: 0 };
    const wantedGaze = { x: 0, y: 0 };

    /* the bust follows the pointer anywhere over the lab, eased so the
       head turns like attention rather than tracking */
    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const spread = 2.6; /* respond across the lab, not just the canvas */
      const region = {
        left: rect.left + rect.width * (1 - spread) * 0.5,
        top: rect.top + rect.height * (1 - spread) * 0.5,
        width: rect.width * spread,
        height: rect.height * spread,
      };
      const target = gazeTarget(event.clientX, event.clientY, region);
      wantedGaze.x = target.x;
      wantedGaze.y = target.y * 0.6;
    };
    window.addEventListener("pointermove", onPointerMove);

    const animate = (stamp: number) => {
      const signal = signalRef.current;
      const target = signal.isMuted
        ? 0
        : Math.max(signal.level, signal.isListening ? 0.1 : 0);
      smoothedLevel += (target - smoothedLevel) * (target > smoothedLevel ? 0.16 : 0.05);
      gaze.x += (wantedGaze.x - gaze.x) * 0.045;
      gaze.y += (wantedGaze.y - gaze.y) * 0.045;

      const mood = signal.isMuted ? 3 : signal.isSpeaking ? 2 : signal.isListening ? 1 : 0;
      syncRendererSize(renderer);
      renderer.clear();
      stage.update(
        { timeMs: stamp, level: smoothedLevel, mood, gaze, mirror: true },
        { width: canvas.width, height: canvas.height },
      );
      renderer.render(stage.scene, stage.camera);
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      cancelAnimationFrame(frameId);
      stage.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      className={`voice-orb ${state} ${isMuted ? "muted" : ""}`}
      style={orbStyle}
      aria-label={`Agent voice visualizer: ${state}`}
    >
      <div className="voice-orb-stage">
        <div className="voice-orb-field">
          <canvas
            ref={canvasRef}
            className="voice-orb-canvas"
            aria-hidden="true"
          />
          {renderError ? (
            <div className="voice-orb-fallback">{renderError}</div>
          ) : null}
        </div>
      </div>
      <div className="voice-orb-caption">
        {captionForState({ isListening, isMuted, isSpeaking })}
      </div>
    </div>
  );
}

function captionForState(input: {
  isListening: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
}): string {
  if (input.isMuted) return "mute";
  if (input.isSpeaking) return "agent voice";
  if (input.isListening) return "listening";
  return "system idle";
}
