import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { VoiceAffect } from "@voiceagentsdk/core/client/browser";
import type { AffectSignal } from "../../../components/hologram/face/affect.js";
import { gazeTarget } from "../../../components/hologram/holo-motion.js";
import {
  prefersStaticMotion,
  staticFrameTimeMs,
  watchMotionPreference,
} from "../../../components/scene/scene-motion-policy.js";
import { createRtcStagePost } from "./rtc-stage-post.js";
import {
  createRtcStageRenderer,
  disposeRtcStageRenderer,
  syncRendererSize,
} from "./rtc-stage-renderer.js";
import { createRtcStageScene } from "./rtc-stage-scene.js";
import "../styles/components/VoiceOrb.css";

interface VoiceSignal {
  isListening: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  level: number;
  bands: readonly [number, number, number, number] | null;
}

export function VoiceOrb({
  state,
  isMuted,
  outputLevel,
  outputBands = null,
  affect = null,
}: {
  state: string;
  isMuted: boolean;
  outputLevel: number;
  /** Spectral split of the output audio — viseme mouth shaping. */
  outputBands?: readonly [number, number, number, number] | null;
  /** Latest LLM-signaled affect from the session snapshot (wall clock). */
  affect?: (VoiceAffect & { at: number }) | null;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const signalRef = useRef<VoiceSignal>({
    isListening: false,
    isMuted: false,
    isSpeaking: false,
    level: 0,
    bands: null,
  });
  /* the rig decays affect on the rAF clock — restamp the wall-clock
     arrival time with the frame time when a new affect lands */
  const affectRef = useRef<(VoiceAffect & { at: number }) | null>(affect);
  const framedAffectRef = useRef<AffectSignal | null>(null);
  affectRef.current = affect;
  const [renderError, setRenderError] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(prefersStaticMotion);
  const staticRenderRef = useRef<(() => void) | null>(null);
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
    signalRef.current = { isListening, isMuted, isSpeaking, level, bands: outputBands };
    staticRenderRef.current?.(); /* reduced motion: one frame per state change */
  }, [isListening, isMuted, isSpeaking, level, outputBands]);

  useEffect(() => watchMotionPreference(setReducedMotion), []);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return undefined;

    /* a fresh canvas per mount: forceContextLoss on teardown frees the
       GL context immediately, and a remount (StrictMode, motion flip)
       must not inherit that dead context */
    const canvas = document.createElement("canvas");
    canvas.className = "voice-orb-canvas";
    canvas.setAttribute("aria-hidden", "true");
    field.prepend(canvas);

    const renderer = createRtcStageRenderer(canvas);
    if (!renderer) {
      canvas.remove();
      setRenderError("webgl unavailable");
      return undefined;
    }
    const stage = createRtcStageScene(1001); /* distinct blink/idle seed */
    const post = createRtcStagePost(renderer, stage.scene, stage.camera);
    let lastStamp = 0;
    let lastW = 0;
    let lastH = 0;

    let frameId = 0;
    let smoothedLevel = 0;
    const gaze = { x: 0, y: 0 };
    const wantedGaze = { x: 0, y: 0 };

    if (reducedMotion) {
      /* no continuous loop: one calm static pose per state change */
      const renderStatic = () => {
        const signal = signalRef.current;
        const staticLevel = signal.isMuted ? 0 : signal.isListening ? 0.1 : 0;
        const mood = signal.isMuted ? 3 : signal.isSpeaking ? 2 : signal.isListening ? 1 : 0;
        syncRendererSize(renderer);
        post.setSize(canvas.clientWidth, canvas.clientHeight);
        stage.update(
          { timeMs: staticFrameTimeMs(), level: staticLevel, mood, gaze, mirror: true, still: true },
          { width: canvas.width, height: canvas.height },
        );
        post.render(0.016);
      };
      frameId = requestAnimationFrame(renderStatic);
      staticRenderRef.current = renderStatic;
      return () => {
        staticRenderRef.current = null;
        cancelAnimationFrame(frameId);
        post.dispose();
        stage.dispose();
        disposeRtcStageRenderer(renderer);
        canvas.remove();
      };
    }

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

    let seenAffectAt: number | null = null;
    const animate = (stamp: number) => {
      const signal = signalRef.current;
      const target = signal.isMuted
        ? 0
        : Math.max(signal.level, signal.isListening ? 0.1 : 0);
      smoothedLevel += (target - smoothedLevel) * (target > smoothedLevel ? 0.16 : 0.05);
      gaze.x += (wantedGaze.x - gaze.x) * 0.045;
      gaze.y += (wantedGaze.y - gaze.y) * 0.045;

      const wallAffect = affectRef.current;
      if ((wallAffect?.at ?? null) !== seenAffectAt) {
        seenAffectAt = wallAffect?.at ?? null;
        framedAffectRef.current = wallAffect
          ? { label: wallAffect.label, intensity: wallAffect.intensity, at: stamp }
          : null;
      }

      const mood = signal.isMuted ? 3 : signal.isSpeaking ? 2 : signal.isListening ? 1 : 0;
      syncRendererSize(renderer);
      if (canvas.clientWidth !== lastW || canvas.clientHeight !== lastH) {
        lastW = canvas.clientWidth;
        lastH = canvas.clientHeight;
        post.setSize(lastW, lastH);
      }
      stage.update(
        {
          timeMs: stamp,
          level: smoothedLevel,
          levelBands: signal.isMuted ? null : signal.bands,
          mood,
          gaze,
          mirror: true,
          affect: framedAffectRef.current,
        },
        { width: canvas.width, height: canvas.height },
      );
      post.render(lastStamp ? (stamp - lastStamp) / 1000 : 0.016);
      lastStamp = stamp;
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      cancelAnimationFrame(frameId);
      post.dispose();
      stage.dispose();
      disposeRtcStageRenderer(renderer);
      canvas.remove();
    };
  }, [reducedMotion]);

  return (
    <div
      className={`voice-orb ${state} ${isMuted ? "muted" : ""}`}
      style={orbStyle}
      aria-label={`Agent voice visualizer: ${state}`}
    >
      <div className="voice-orb-stage">
        <div className="voice-orb-field" ref={fieldRef}>
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
