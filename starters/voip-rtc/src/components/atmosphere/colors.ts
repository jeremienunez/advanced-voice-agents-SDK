import type { RgbColor } from "./types.js";

const creamColor = { r: 250, g: 248, b: 245 };
const whiteColor = { r: 255, g: 255, b: 255 };
const blackColor = { r: 28, g: 25, b: 23 };
const darkGold = { r: 161, g: 98, b: 7 };
const brightGold = { r: 229, g: 193, b: 88 };

export function getParticleRgb(
  width: number,
  x: number,
  colorType: "gold" | "accent",
  accentSubtype: "white" | "cream",
): RgbColor & { t: number } {
  const boundaryX = width >= 1024 ? width * 0.38 : width * 0.5;
  const blendRange = 160;
  const t = Math.max(
    0,
    Math.min(1, (x - (boundaryX - blendRange / 2)) / blendRange),
  );

  let leftColor = blackColor;
  let rightColor = whiteColor;
  if (colorType === "gold") {
    leftColor = darkGold;
    rightColor = brightGold;
  } else {
    rightColor = accentSubtype === "white" ? whiteColor : creamColor;
  }

  return {
    r: Math.round(leftColor.r + (rightColor.r - leftColor.r) * t),
    g: Math.round(leftColor.g + (rightColor.g - leftColor.g) * t),
    b: Math.round(leftColor.b + (rightColor.b - leftColor.b) * t),
    t,
  };
}
