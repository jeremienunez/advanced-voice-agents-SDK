import type { CSSProperties } from "react";
import "./VoiceOrb.css";

export function VoiceOrb({
  state,
  isMuted,
  outputLevel,
}: {
  state: string;
  isMuted: boolean;
  outputLevel: number;
}) {
  const level = Math.min(1, Math.max(0, outputLevel));
  const isListening = state === "listening";
  const isSpeaking = state === "speaking";
  const isActive = (isListening || isSpeaking) && !isMuted;
  const orbStyle = {
    "--voice-level": level.toFixed(3),
    "--orb-scale": (1 + level * 0.1).toFixed(3),
    "--wave-scale": (isSpeaking ? 0.45 + level * 1.5 : 0.12).toFixed(3),
    "--halo-opacity": (isActive ? 0.42 + level * 0.34 : 0.18).toFixed(3),
    "--halo-scale": (0.96 + level * 0.18).toFixed(3),
    "--blue-alpha": (0.15 + level * 0.26).toFixed(3),
    "--gold-alpha": (0.12 + level * 0.2).toFixed(3),
    "--core-opacity": (0.46 + level * 0.34).toFixed(3),
    "--core-scale": (0.9 + level * 0.18).toFixed(3),
    "--wave-opacity": (0.38 + level * 0.46).toFixed(3),
    "--wave-stroke": `${(1.4 + level * 1.2).toFixed(2)}px`,
    "--voice-glow-radius": `${Math.round(70 + level * 70)}px`,
    "--ring-speed": `${Math.max(4.8, 13 - level * 7).toFixed(2)}s`,
    "--ring-speed-slow": `${Math.max(5.8, 15.6 - level * 8.4).toFixed(2)}s`,
    "--ring-speed-fast": `${Math.max(3.8, 10.4 - level * 5.6).toFixed(2)}s`,
  } as CSSProperties;

  return (
    <div
      className={`voice-orb ${state} ${isMuted ? "muted" : ""}`}
      style={orbStyle}
      aria-label={`Agent voice visualizer: ${state}`}
    >
      <div className="voice-orb-stage">
        <div className="voice-orb-halo halo-blue" />
        <div className="voice-orb-halo halo-gold" />
        <div className="voice-orb-halo halo-mint" />
        <div className="voice-orb-shell">
          <div className="voice-orb-ring ring-a" />
          <div className="voice-orb-ring ring-b" />
          <div className="voice-orb-ring ring-c" />
          <div className="voice-orb-core" />
          <svg
            className="voice-orb-waves"
            viewBox="0 0 240 64"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              className="orb-wave wave-blue"
              d="M0 32 C30 10 48 10 78 32 S126 54 156 32 204 10 240 32"
            />
            <path
              className="orb-wave wave-gold"
              d="M0 32 C24 52 52 52 80 32 S132 12 160 32 210 52 240 32"
            />
            <path
              className="orb-wave wave-mint"
              d="M0 32 C34 22 44 22 78 32 S128 42 158 32 208 22 240 32"
            />
          </svg>
          <div className="voice-orb-glass" />
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
