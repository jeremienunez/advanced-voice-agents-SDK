import {
  type AtmosphereMode,
  resolveOrbAnchor,
} from "./anchor.js";
import { getParticleRgb } from "./colors.js";
import { createParticles, isFormTarget } from "./particles.js";

export type { AtmosphereMode } from "./anchor.js";

interface AtmosphereOptions {
  mode?: AtmosphereMode;
}

export function runAtmosphere(
  canvas: HTMLCanvasElement,
  options: AtmosphereOptions = {},
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  let width = window.innerWidth;
  let height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;

  const handleResize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  };
  window.addEventListener("resize", handleResize);

  const mouse = { x: -1000, y: -1000 };
  const handleMouseMove = (event: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  };
  const handleMouseLeave = () => {
    mouse.x = -1000;
    mouse.y = -1000;
  };
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseleave", handleMouseLeave);

  let speedMultiplier = 1;
  let typingEnergy = 0;
  let targetSpeed = 1;

  const handleFocusIn = (event: FocusEvent) => {
    if (isFormTarget(event.target)) targetSpeed = 1.45;
  };
  const handleFocusOut = (event: FocusEvent) => {
    if (isFormTarget(event.target)) targetSpeed = 1;
  };
  const handleInput = (event: Event) => {
    if (isFormTarget(event.target)) typingEnergy = 1.4;
  };
  document.addEventListener("focusin", handleFocusIn);
  document.addEventListener("focusout", handleFocusOut);
  document.addEventListener("input", handleInput);

  const particles = createParticles(width, height);
  const particleCount = particles.length;
  let orbTransition = 0;
  let orbPhase: "boids" | "entering" | "spinning" | "exiting" = "boids";
  let phaseTimer = 0;
  let frameId = 0;

  const animate = () => {
    ctx.clearRect(0, 0, width, height);

    speedMultiplier += (targetSpeed - speedMultiplier) * 0.05;
    typingEnergy *= 0.94;
    const currentSpeed = speedMultiplier + typingEnergy * 1.6;
    const time = Date.now() * 0.00072;

    phaseTimer += 1;
    if (orbPhase === "boids" && phaseTimer > 260) {
      orbPhase = "entering";
      phaseTimer = 0;
    } else if (orbPhase === "entering") {
      orbTransition += 0.022;
      if (orbTransition >= 1) {
        orbTransition = 1;
        orbPhase = "spinning";
        phaseTimer = 0;
      }
    } else if (orbPhase === "spinning" && phaseTimer > 170) {
      orbPhase = "exiting";
      phaseTimer = 0;
    } else if (orbPhase === "exiting") {
      orbTransition -= 0.018;
      if (orbTransition <= 0) {
        orbTransition = 0;
        orbPhase = "boids";
        phaseTimer = 0;
      }
    }

    for (let i = 0; i < particles.length; i += 1) {
      const particle = particles[i];
      let avgVx = 0;
      let avgVy = 0;
      let avgPx = 0;
      let avgPy = 0;
      let avoidX = 0;
      let avoidY = 0;
      let neighborsCount = 0;
      let closeNeighborsCount = 0;

      for (let j = 0; j < particles.length; j += 1) {
        if (i === j) continue;
        const neighbor = particles[j];
        const dx = neighbor.x - particle.x;
        const dy = neighbor.y - particle.y;
        const distance = Math.hypot(dx, dy);

        if (distance < 82) {
          avgVx += neighbor.vx;
          avgVy += neighbor.vy;
          avgPx += neighbor.x;
          avgPy += neighbor.y;
          neighborsCount += 1;

          if (distance < 24) {
            avoidX -= dx;
            avoidY -= dy;
            closeNeighborsCount += 1;
          }
        }
      }

      if (neighborsCount > 0) {
        avgVx /= neighborsCount;
        avgVy /= neighborsCount;
        avgPx /= neighborsCount;
        avgPy /= neighborsCount;
        particle.vx += (avgVx - particle.vx) * 0.04 * (1 - orbTransition);
        particle.vy += (avgVy - particle.vy) * 0.04 * (1 - orbTransition);
        particle.vx += (avgPx - particle.x) * 0.00055 * (1 - orbTransition);
        particle.vy += (avgPy - particle.y) * 0.00055 * (1 - orbTransition);
      }

      if (closeNeighborsCount > 0) {
        particle.vx += avoidX * 0.015 * (1 - orbTransition * 0.5);
        particle.vy += avoidY * 0.015 * (1 - orbTransition * 0.5);
      }

      const dxCenter = particle.x - width * 0.5;
      const dyCenter = particle.y - height * 0.5;
      const distCenter = Math.hypot(dxCenter, dyCenter);
      if (distCenter > 10) {
        particle.vx += (-dyCenter / distCenter) * 0.022 * (1 - orbTransition);
        particle.vy += (dxCenter / distCenter) * 0.022 * (1 - orbTransition);
      }

      const flowAngle =
        Math.sin(particle.x * 0.003 + time) *
        Math.cos(particle.y * 0.003 + time) *
        Math.PI *
        2;
      particle.vx += Math.cos(flowAngle) * 0.074 * (1 - orbTransition);
      particle.vy += Math.sin(flowAngle) * 0.074 * (1 - orbTransition);

      const phi = Math.acos(1 - (2 * (i + 0.5)) / particleCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
      const anchor = resolveOrbAnchor(width, height, options.mode);
      const radius = Math.min(width, height) * anchor.radiusRatio;
      const sx = radius * Math.sin(phi) * Math.cos(theta);
      const sy = radius * Math.sin(phi) * Math.sin(theta);
      const sz = radius * Math.cos(phi);
      const rotY = time * 0.72;
      const rotX = Math.sin(time * 0.42) * 0.38;
      const rx = sx * Math.cos(rotY) - sz * Math.sin(rotY);
      const rz = sx * Math.sin(rotY) + sz * Math.cos(rotY);
      const ry = sy * Math.cos(rotX) - rz * Math.sin(rotX);
      const targetX = anchor.x + rx;
      const targetY = anchor.y + ry;

      if (orbTransition > 0) {
        particle.vx += (targetX - particle.x) * 0.075 * orbTransition;
        particle.vy += (targetY - particle.y) * 0.075 * orbTransition;
        if (orbPhase === "spinning") {
          particle.x += (targetX - particle.x) * 0.12;
          particle.y += (targetY - particle.y) * 0.12;
        }
      }

      moveParticleAwayFromMouse(particle, mouse.x, mouse.y, orbTransition);
      renderParticle(
        ctx,
        particle,
        width,
        height,
        typingEnergy,
        currentSpeed,
        orbTransition,
      );
    }

    frameId = requestAnimationFrame(animate);
  };

  animate();

  return () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseleave", handleMouseLeave);
    document.removeEventListener("focusin", handleFocusIn);
    document.removeEventListener("focusout", handleFocusOut);
    document.removeEventListener("input", handleInput);
  };
}

function moveParticleAwayFromMouse(
  particle: ReturnType<typeof createParticles>[number],
  mouseX: number,
  mouseY: number,
  orbTransition: number,
) {
  if (mouseX === -1000 || mouseY === -1000) return;
  const dxMouse = particle.x - mouseX;
  const dyMouse = particle.y - mouseY;
  const distMouse = Math.hypot(dxMouse, dyMouse);
  if (distMouse >= 160) return;
  const force = (1 - distMouse / 160) * 0.85;
  const angle = Math.atan2(dyMouse, dxMouse);
  const mouseStrength = 1 - orbTransition * 0.6;
  particle.x += Math.cos(angle) * force * 3 * mouseStrength;
  particle.y += Math.sin(angle) * force * 3 * mouseStrength;
  particle.vx += Math.cos(angle) * force * 0.45 * mouseStrength;
  particle.vy += Math.sin(angle) * force * 0.45 * mouseStrength;
}

function renderParticle(
  ctx: CanvasRenderingContext2D,
  particle: ReturnType<typeof createParticles>[number],
  width: number,
  height: number,
  typingEnergy: number,
  currentSpeed: number,
  orbTransition: number,
) {
  const speedLimit = 2.45 + typingEnergy * 2;
  const particleSpeed = Math.hypot(particle.vx, particle.vy);
  if (particleSpeed > speedLimit) {
    particle.vx = (particle.vx / particleSpeed) * speedLimit;
    particle.vy = (particle.vy / particleSpeed) * speedLimit;
  }

  particle.vx *= 0.985;
  particle.vy *= 0.985;
  particle.x += particle.vx * currentSpeed;
  particle.y += particle.vy * currentSpeed;

  if (orbTransition < 0.25) {
    if (particle.x < -30) particle.x = width + 30;
    if (particle.x > width + 30) particle.x = -30;
    if (particle.y < -30) particle.y = height + 30;
    if (particle.y > height + 30) particle.y = -30;
  }

  const rgb = getParticleRgb(width, particle.x, particle.colorType, particle.accentSubtype);
  const nodeAlpha = particle.alpha * (0.85 + typingEnergy * 0.5);
  const alphaMultiplier = 1.2 - (1.2 - 1) * rgb.t;
  const finalAlpha = Math.min(0.88, nodeAlpha * alphaMultiplier);

  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${finalAlpha})`;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.size * 3, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${finalAlpha * 0.16})`;
  ctx.fill();
}
