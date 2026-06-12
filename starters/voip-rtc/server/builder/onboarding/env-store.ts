import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeEnvValue,
  readEnvSources,
  writeLocalEnvFile,
  type EnvSources,
} from "./env-dotenv.js";
import {
  envFieldDefinitions,
} from "./env-fields.js";
import { requirementStates } from "./env-requirements.js";
import type {
  EnvFieldDefinition,
  EnvFieldState,
} from "./env-types.js";

export { envFieldDefinitions } from "./env-fields.js";
export type {
  EnvFieldDefinition,
  EnvFieldGroup,
  EnvFieldState,
  EnvRequirementState,
} from "./env-types.js";

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const rootEnvPath = fileURLToPath(new URL("../../../../../.env", import.meta.url));
const starterEnvPath = fileURLToPath(new URL("../../../.env", import.meta.url));
const localEnvPath = fileURLToPath(new URL("../../../.env.local", import.meta.url));

export function readOnboardingEnvStore() {
  const sources = readSources();
  const fields = envFieldDefinitions.map((definition) => {
    return stateFor(definition, sources);
  });
  return {
    store: {
      format: "dotenv-v2",
      path: relative(repoRoot, localEnvPath),
      restartRequired: true,
    },
    fields,
    requirements: requirementStates(fields),
  };
}

export function writeOnboardingEnvStore(values: Record<string, unknown>) {
  const allowed = new Set(envFieldDefinitions.map((item) => item.name));
  const updates = new Map<string, string>();
  const removals = new Set<string>();

  for (const [key, rawValue] of Object.entries(values)) {
    if (!allowed.has(key)) throw new Error(`Unsupported env key: ${key}`);
    if (typeof rawValue !== "string") continue;
    const value = normalizeEnvValue(rawValue);
    if (value) updates.set(key, value);
    else removals.add(key);
  }

  writeLocalEnvFile(localEnvPath, updates, removals);
  return readOnboardingEnvStore();
}

function readSources(): EnvSources {
  return readEnvSources({ rootEnvPath, starterEnvPath, localEnvPath });
}

function stateFor(definition: EnvFieldDefinition, sources: ReturnType<typeof readSources>): EnvFieldState {
  const match =
    sourceValue("process", definition.name, sources.process) ??
    sourceValue("local", definition.name, sources.local) ??
    sourceValue("starter", definition.name, sources.starter) ??
    sourceValue("root", definition.name, sources.root);
  const value = match?.value;
  return {
    ...definition,
    configured: Boolean(value),
    source: match?.source ?? "missing",
    value: definition.secret ? undefined : value,
    maskedValue: definition.secret && value ? maskSecret(value) : undefined,
  };
}

function sourceValue(
  source: EnvFieldState["source"],
  key: string,
  values: Record<string, string | undefined>,
) {
  const value = values[key];
  return value ? { source, value } : undefined;
}

function maskSecret(value: string): string {
  if (value.length <= 8) return "configured";
  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}
