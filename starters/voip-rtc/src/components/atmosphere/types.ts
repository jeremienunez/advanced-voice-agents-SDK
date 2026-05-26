export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  colorType: "gold" | "accent";
  accentSubtype: "white" | "cream";
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}
