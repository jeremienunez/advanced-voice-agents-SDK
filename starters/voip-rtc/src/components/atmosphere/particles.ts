import type { Particle } from "./types.js";

export function createParticles(width: number, height: number): Particle[] {
  const particleCount = window.matchMedia("(max-width: 760px)").matches
    ? 220
    : 420;
  const particles: Particle[] = [];
  for (let i = 0; i < particleCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 1.55 + 0.55;
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 1.45 + 1.25,
      alpha: Math.random() * 0.28 + 0.42,
      colorType: Math.random() > 0.58 ? "gold" : "accent",
      accentSubtype: Math.random() > 0.45 ? "green" : "blue",
    });
  }
  return particles;
}

export function isFormTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
