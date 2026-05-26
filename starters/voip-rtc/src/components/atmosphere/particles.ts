import type { Particle } from "./types.js";

export function createParticles(width: number, height: number): Particle[] {
  const particleCount = window.matchMedia("(max-width: 760px)").matches
    ? 180
    : 360;
  const particles: Particle[] = [];
  for (let i = 0; i < particleCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 1.35 + 0.45;
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 1.1 + 1,
      alpha: Math.random() * 0.34 + 0.2,
      colorType: Math.random() > 0.45 ? "gold" : "accent",
      accentSubtype: Math.random() > 0.5 ? "white" : "cream",
    });
  }
  return particles;
}

export function isFormTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
