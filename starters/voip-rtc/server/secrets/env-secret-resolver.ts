import type {
  SecretResolveInput,
  SecretResolverPort,
} from "@voiceagentsdk/core/sdk";
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

export function createEnvSecretResolver(
  env: Record<string, string | undefined> = Bun.env,
): SecretResolverPort {
  return {
    resolveSecret(input: SecretResolveInput): string | undefined {
      const names = secretNames(input);
      for (const name of names) {
        const value = env[name];
        if (value) return value;
      }
      
      const localEnv = readDotEnv(localEnvPath);
      for (const name of names) {
        if (localEnv[name]) return localEnv[name];
      }
      
      const starterEnv = readDotEnv(starterEnvPath);
      for (const name of names) {
        if (starterEnv[name]) return starterEnv[name];
      }
      
      const rootEnv = readDotEnv(rootEnvPath);
      for (const name of names) {
        if (rootEnv[name]) return rootEnv[name];
      }
      
      return undefined;
    },
  };
}

function secretNames(input: SecretResolveInput): string[] {
  return Array.from(new Set([input.ref.name, ...(input.aliases ?? [])]));
}
