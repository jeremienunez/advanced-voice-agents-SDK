export function extractPreferences(text: string): string[] {
  if (!text) return [];
  const preferences: string[] = [];
  const patterns = [
    /\b(?:i prefer|i like|je prefere|j'aime)\s+([^.!?]{3,120})/gi,
    /\b(?:call me|appelle-moi)\s+([^.!?]{2,80})/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      preferences.push(`User preference: ${sanitizeText(match[1] ?? "")}`);
    }
  }
  return preferences.slice(0, 5);
}

export function stableToken(value: string): string {
  return sanitizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function collectRedactions(value: string): string[] {
  const checks: Array<[string, RegExp]> = [
    ["openai-key", /sk-[A-Za-z0-9_-]{12,}/],
    ["bearer-token", /Bearer\s+[A-Za-z0-9._-]+/i],
    ["named-secret", /(api[_-]?key|token|secret|password)\s*[:=]\s*\S+/i],
  ];
  return checks
    .filter(([, pattern]) => pattern.test(value))
    .map(([name]) => name);
}

export function sanitizeText(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[redacted-secret]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted-secret]")
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*\S+/gi, "$1=[redacted-secret]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800);
}
