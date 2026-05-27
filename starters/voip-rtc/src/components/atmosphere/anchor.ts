export type AtmosphereMode = "onboarding" | "hub" | "builder" | "agents" | "rtc";

export function resolveOrbAnchor(
  width: number,
  height: number,
  mode: AtmosphereMode = "onboarding",
) {
  if (width < 1024) {
    return {
      x: width * 0.5,
      y: height * 0.38,
      radiusRatio: 0.2,
    };
  }

  if (mode === "builder" || mode === "hub") {
    return {
      x: width * 0.42 + 16,
      y: height * 0.42,
      radiusRatio: 0.24,
    };
  }

  return {
    x: width * 0.82,
    y: height * 0.34,
    radiusRatio: 0.22,
  };
}
