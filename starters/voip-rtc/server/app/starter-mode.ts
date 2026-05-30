export type StarterMode = "local" | "demo" | "production";

export function starterModeFromEnv(
  env: Record<string, string | undefined>,
): StarterMode {
  const value = env.VOICE_STARTER_MODE?.trim().toLowerCase();
  if (!value) return "local";
  if (value === "demo" || value === "production") return value;
  if (value === "local") return value;
  throw new Error(
    `VOICE_STARTER_MODE must be local, demo, or production; got "${value}"`,
  );
}

export function isProductionStarterMode(mode: StarterMode | undefined): boolean {
  return mode === "production";
}

export function assertLocalFileStateAllowed(mode: StarterMode): void {
  if (mode !== "production") return;
  throw new Error(
    "local file state for builder drafts, active sessions, and learning runs is local-only and refused in production starter mode",
  );
}
