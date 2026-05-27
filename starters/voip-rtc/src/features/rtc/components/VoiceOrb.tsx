import { useEffect, useRef, type CSSProperties } from "react";
import "./VoiceOrb.css";

interface VoiceParticle {
  x: number;
  y: number;
  z: number;
  size: number;
  phase: number;
  color: [number, number, number];
}

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
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return undefined;

    const particles = createVoiceParticles(520);
    let frameId = 0;
    let ratio = 1;
    let viewWidth = 1;
    let viewHeight = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      viewWidth = Math.max(1, rect.width);
      viewHeight = Math.max(1, rect.height);
      canvas.width = Math.floor(viewWidth * ratio);
      canvas.height = Math.floor(viewHeight * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const animate = (stamp: number) => {
      const signal = signalRef.current;
      const audioLevel = signal.isMuted
        ? 0
        : Math.max(signal.level, signal.isListening ? 0.12 : 0);
      const time = stamp * 0.001;
      const cx = viewWidth / 2;
      const cy = viewHeight / 2;
      const radius = Math.min(viewWidth, viewHeight) * (0.43 + audioLevel * 0.06);
      const rotY = time * (0.34 + audioLevel * 0.84);
      const rotX = Math.sin(time * 0.38) * (0.28 + audioLevel * 0.14);
      const pulse = Math.sin(time * (2.2 + audioLevel * 6.2)) * audioLevel;

      ctx.clearRect(0, 0, viewWidth, viewHeight);
      renderHologramCore(ctx, cx, cy, radius, audioLevel, signal);

      for (const particle of particles) {
        const rotated = rotatePoint(particle, rotX, rotY);
        const depth = (rotated.z + 1) / 2;
        const voicePush =
          Math.sin(time * 7.5 + particle.phase) * audioLevel * 13 +
          pulse * depth * 11;
        const projection = 0.72 + depth * 0.38;
        const x = cx + rotated.x * (radius + voicePush) * projection;
        const y = cy + rotated.y * (radius * 0.92 + voicePush) * projection;
        const size = particle.size * (0.68 + depth * 1.18 + audioLevel * 0.72);
        const alpha =
          (0.26 + depth * 0.54 + audioLevel * 0.22) *
          (signal.isMuted ? 0.36 : 1);

        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${particle.color[0]}, ${particle.color[1]}, ${particle.color[2]}, ${alpha})`;
        ctx.fill();
      }

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
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
        </div>
      </div>
      <div className="voice-orb-caption">
        {captionForState({ isListening, isMuted, isSpeaking })}
      </div>
    </div>
  );
}

function createVoiceParticles(count: number): VoiceParticle[] {
  const colors: Array<[number, number, number]> = [
    [66, 133, 244],
    [52, 168, 83],
    [251, 188, 5],
    [14, 165, 233],
  ];

  return Array.from({ length: count }, (_, index) => {
    const phi = Math.acos(1 - (2 * (index + 0.5)) / count);
    const theta = Math.PI * (1 + Math.sqrt(5)) * (index + 0.5);
    return {
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.sin(phi) * Math.sin(theta),
      z: Math.cos(phi),
      size: 1.05 + ((index * 17) % 9) * 0.08,
      phase: index * 0.71,
      color: colors[index % colors.length],
    };
  });
}

function renderHologramCore(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  level: number,
  signal: VoiceSignal,
) {
  const alpha = signal.isMuted ? 0.08 : 0.15 + level * 0.22;
  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.05, cx, cy, radius);
  gradient.addColorStop(0, `rgba(255, 255, 255, ${0.52 + level * 0.2})`);
  gradient.addColorStop(0.42, `rgba(66, 133, 244, ${alpha})`);
  gradient.addColorStop(0.72, `rgba(52, 168, 83, ${alpha * 0.64})`);
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.beginPath();
  ctx.arc(cx, cy, radius * (0.74 + level * 0.1), 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
}

function rotatePoint(particle: VoiceParticle, rotX: number, rotY: number) {
  const rx = particle.x * Math.cos(rotY) - particle.z * Math.sin(rotY);
  const rz = particle.x * Math.sin(rotY) + particle.z * Math.cos(rotY);
  const ry = particle.y * Math.cos(rotX) - rz * Math.sin(rotX);
  return { x: rx, y: ry, z: particle.y * Math.sin(rotX) + rz * Math.cos(rotX) };
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
