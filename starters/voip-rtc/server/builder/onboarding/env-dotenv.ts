import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface EnvSourcePaths {
  rootEnvPath: string;
  starterEnvPath: string;
  localEnvPath: string;
}

export interface EnvSources {
  root: Record<string, string>;
  starter: Record<string, string>;
  local: Record<string, string>;
  process: Record<string, string | undefined>;
}

export function readEnvSources(paths: EnvSourcePaths): EnvSources {
  return {
    root: readDotEnv(paths.rootEnvPath),
    starter: readDotEnv(paths.starterEnvPath),
    local: readDotEnv(paths.localEnvPath),
    process: Bun.env,
  };
}

export function writeLocalEnvFile(
  localEnvPath: string,
  updates: Map<string, string>,
  removals: Set<string>,
) {
  const managed = new Set([...updates.keys(), ...removals]);
  const previous = existsSync(localEnvPath) ? readFileSync(localEnvPath, "utf8") : "";
  const kept = previous.split(/\r?\n/).filter((line) => {
    const key = line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1];
    return !key || !managed.has(key);
  });
  const next = [...kept.filter(Boolean)];
  if (updates.size) {
    next.push("", "# Voice Agent SDK onboarding config");
    for (const [key, value] of [...updates.entries()].sort()) {
      next.push(`${key}=${dotEnvValue(value)}`);
    }
  }
  mkdirSync(dirname(localEnvPath), { recursive: true });
  writeFileSync(localEnvPath, `${next.join("\n").trim()}\n`);
}

export function normalizeEnvValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function readDotEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const env: Record<string, string> = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    env[key] = value.replace(/^["']|["']$/g, "");
  }
  return env;
}

function dotEnvValue(value: string): string {
  return /^[A-Za-z0-9_./:@,+-]+$/.test(value)
    ? value
    : JSON.stringify(value);
}
