export function resolveAllowedOrigins(): Set<string> {
  const configured = Bun.env.VOICE_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origins = configured?.length
    ? configured
    : [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
      ];
  return new Set(origins);
}

export function firstAllowedOrigin(allowedOrigins: Set<string>): string {
  return allowedOrigins.values().next().value ?? "http://localhost:5173";
}

export function isAllowedOrigin(
  allowedOrigins: Set<string>,
  origin: string,
): boolean {
  if (allowedOrigins.has(origin)) return true;
  try {
    return isLoopbackHost(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function isLoopbackHost(value: string): boolean {
  return (
    value === "127.0.0.1" ||
    value === "localhost" ||
    value === "[::1]" ||
    value === "::1"
  );
}
