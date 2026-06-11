/** Bridges the CSS design tokens into the WebGL scenes: reads the
    --studio-*-rgb triplets at runtime and watches the .studio-dark class
    so a theme flip retints the deck without a reload. */

export interface ScenePalette {
  readonly action: readonly [number, number, number];
  readonly success: readonly [number, number, number];
  readonly danger: readonly [number, number, number];
  readonly dark: boolean;
}

const FALLBACK_LIGHT: ScenePalette = {
  action: [21 / 255, 95 / 255, 212 / 255],
  success: [12 / 255, 143 / 255, 96 / 255],
  danger: [207 / 255, 46 / 255, 87 / 255],
  dark: false,
};

export function parseRgbTriplet(raw: string): [number, number, number] | null {
  const parts = raw.split(",").map((part) => part.trim());
  if (parts.length !== 3) return null;
  const values = parts.map((part) => (part === "" ? Number.NaN : Number(part)));
  if (values.some((v) => !Number.isFinite(v) || v < 0 || v > 255)) return null;
  return [values[0] / 255, values[1] / 255, values[2] / 255];
}

function readPalette(): ScenePalette {
  if (typeof window === "undefined") return FALLBACK_LIGHT;
  const style = getComputedStyle(document.documentElement);
  const read = (token: string, fallback: readonly [number, number, number]) =>
    parseRgbTriplet(style.getPropertyValue(token)) ?? fallback;
  return {
    action: read("--studio-action-rgb", FALLBACK_LIGHT.action),
    success: read("--studio-success-rgb", FALLBACK_LIGHT.success),
    danger: read("--studio-danger-rgb", FALLBACK_LIGHT.danger),
    dark: document.documentElement.classList.contains("studio-dark"),
  };
}

/** Emits the palette immediately, then on every theme class change. */
export function watchScenePalette(onChange: (palette: ScenePalette) => void): () => void {
  onChange(readPalette());
  if (typeof window === "undefined") return () => {};
  const observer = new MutationObserver(() => onChange(readPalette()));
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
