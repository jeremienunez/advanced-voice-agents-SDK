import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const localEnvPath = fileURLToPath(new URL("../../.env.local", import.meta.url));
const starterEnvPath = fileURLToPath(new URL("../../.env", import.meta.url));
const rootEnvPath = fileURLToPath(new URL("../../../../.env", import.meta.url));

function readDotEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const env: Record<string, string> = {};
  try {
    for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const index = line.indexOf("=");
      if (index <= 0) continue;
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim();
      env[key] = value.replace(/^["']|["']$/g, "");
    }
  } catch {
    // ignore
  }
  return env;
}

export function hasAnyEnv(names: string[]): boolean {
  if (names.some((name) => Boolean(Bun.env[name]))) return true;
  
  const localEnv = readDotEnv(localEnvPath);
  if (names.some((name) => Boolean(localEnv[name]))) return true;
  
  const starterEnv = readDotEnv(starterEnvPath);
  if (names.some((name) => Boolean(starterEnv[name]))) return true;
  
  const rootEnv = readDotEnv(rootEnvPath);
  if (names.some((name) => Boolean(rootEnv[name]))) return true;
  
  return false;
}
