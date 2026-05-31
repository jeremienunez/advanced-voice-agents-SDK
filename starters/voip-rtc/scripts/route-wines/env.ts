import type { HarnessBudget, JsonRecord } from "./types.js";

export async function readDotEnv(url: URL): Promise<Record<string, string>> {
  const file = Bun.file(url);
  if (!(await file.exists())) return {};

  const nextEnv: Record<string, string> = {};
  const text = await file.text();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    nextEnv[key] = value.replace(/^["']|["']$/g, "");
  }
  return nextEnv;
}

export function readHarnessBudget(
  source: Record<string, string | undefined>,
): HarnessBudget {
  return {
    maxCycles: readNumber(source.HARNESS_RESEARCH_MAX_CYCLES, 5),
    maxQueriesPerCycle: readNumber(
      source.HARNESS_RESEARCH_MAX_QUERIES_PER_CYCLE,
      3,
    ),
    maxSources: readNumber(source.HARNESS_RESEARCH_MAX_SOURCES, 6),
    maxEstimatedTokens: readNumber(source.HARNESS_RESEARCH_MAX_TOKENS, 8000),
    maxEstimatedCostUsd: readNumber(source.HARNESS_RESEARCH_MAX_COST_USD, 0.15),
  };
}

export function readNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readBoolean(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function maskEnvAvailability(
  source: Record<string, string | undefined>,
): JsonRecord {
  return {
    DEEPSEEK_API_KEY: Boolean(source.DEEPSEEK_API_KEY),
    VOYAGE_API_KEY: Boolean(source.VOYAGE_API_KEY),
    GEMINI_API_KEY: Boolean(
      source.GEMINI_API_KEY ??
        source.GOOGLE_API_KEY ??
        source.GOOGLE_GENERATIVE_AI_API_KEY,
    ),
    DATABASE_URL: Boolean(source.DATABASE_URL),
  };
}

export function maskDatabaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.password) url.password = "****";
    return url.toString();
  } catch {
    return "configured";
  }
}

export function compactEnv(
  source: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(source).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}
