import type { RgbColor } from "./types.js";

const googleBlue = { r: 66, g: 133, b: 244 };
const googleGreen = { r: 52, g: 168, b: 83 };
const warmGold = { r: 245, g: 158, b: 11 };
const brightGold = { r: 251, g: 188, b: 5 };

export function getParticleRgb(
  width: number,
  x: number,
  colorType: "gold" | "accent",
  accentSubtype: "blue" | "green",
): RgbColor & { t: number } {
  const boundaryX = width >= 1024 ? width * 0.38 : width * 0.5;
  const blendRange = 160;
  const t = Math.max(
    0,
    Math.min(1, (x - (boundaryX - blendRange / 2)) / blendRange),
  );

  let leftColor = googleBlue;
  let rightColor = accentSubtype === "green" ? googleGreen : googleBlue;
  if (colorType === "gold") {
    leftColor = warmGold;
    rightColor = brightGold;
  }

  return {
    r: Math.round(leftColor.r + (rightColor.r - leftColor.r) * t),
    g: Math.round(leftColor.g + (rightColor.g - leftColor.g) * t),
    b: Math.round(leftColor.b + (rightColor.b - leftColor.b) * t),
    t,
  };
}
