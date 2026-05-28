import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

export type EnvFieldGroup =
  | "voice"
  | "builder"
  | "infra"
  | "knowledge"
  | "auth";

export interface EnvFieldDefinition {
  name: string;
  group: EnvFieldGroup;
  label: string;
  description: string;
  secret?: boolean;
  options?: string[];
  defaultValue?: string;
  restartRequired?: boolean;
}

export interface EnvFieldState extends EnvFieldDefinition {
  configured: boolean;
  source: "process" | "local" | "starter" | "root" | "missing";
  value?: string;
  maskedValue?: string;
}

export interface EnvRequirementState {
  id: string;
  group: EnvFieldGroup;
  label: string;
  message: string;
  satisfied: boolean;
  severity: "required" | "recommended";
  candidateKeys: string[];
  mode: "any" | "all";
}

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const starterRoot = fileURLToPath(new URL("../../../", import.meta.url));
const rootEnvPath = fileURLToPath(new URL("../../../../../.env", import.meta.url));
const starterEnvPath = fileURLToPath(new URL("../../../.env", import.meta.url));
const localEnvPath = fileURLToPath(new URL("../../../.env.local", import.meta.url));

export const envFieldDefinitions: EnvFieldDefinition[] = [
  field("DEFAULT_REALTIME_PROVIDER", "voice", "Realtime provider", "Default voice runtime.", ["gemini", "openai"], "gemini"),
  field("VOICE_SERVER_HOST", "voice", "Server host", "Bun starter server bind host. Keep 127.0.0.1 for local dev.", undefined, "127.0.0.1"),
  field("VOICE_PUBLIC_HOST", "voice", "Public host", "Host announced to the browser in /config.", undefined, "127.0.0.1"),
  field("VITE_DEV_HOST", "voice", "Vite host", "Vite dev server bind host.", undefined, "127.0.0.1"),
  field("GEMINI_API_KEY", "voice", "Gemini API key", "Enables Gemini Live voice and Gemini planner.", undefined, undefined, true),
  field("GOOGLE_API_KEY", "voice", "Google API key", "Alternative Gemini key name supported by the starter.", undefined, undefined, true),
  field("GEMINI_REALTIME_MODEL", "voice", "Gemini voice model", "Gemini Live model used by the RTC lab.", undefined, "gemini-3.1-flash-live-preview"),
  field("GEMINI_REALTIME_VOICE", "voice", "Gemini voice", "Voice name used by Gemini Live.", undefined, "Puck"),
  field("OPENAI_API_KEY", "voice", "OpenAI API key", "Enables OpenAI Realtime voice.", undefined, undefined, true),
  field("OPENAI_REALTIME_MODEL", "voice", "OpenAI realtime model", "OpenAI Realtime model used by the RTC lab.", undefined, "gpt-realtime-1.5"),
  field("OPENAI_REALTIME_VOICE", "voice", "OpenAI voice", "Voice name used by OpenAI Realtime.", undefined, "marin"),
  field("BUILDER_PROMPT_PROVIDER", "builder", "Planner provider", "Adaptive planner provider for prompt/build tasks.", ["gemini", "deepseek", "qwen", "kimi"], "gemini"),
  field("GEMINI_TEXT_MODEL", "builder", "Gemini text model", "Gemini model for builder planning tasks.", undefined, "gemini-3.5-flash"),
  field("DEEPSEEK_API_KEY", "builder", "DeepSeek API key", "Enables DeepSeek planner/research profiles.", undefined, undefined, true),
  field("DEEPSEEK_MODEL", "builder", "DeepSeek model", "DeepSeek model for builder planning tasks.", undefined, "deepseek-v4-pro"),
  field("QWEN_API_KEY", "builder", "Qwen API key", "Enables Qwen planner/research profiles.", undefined, undefined, true),
  field("DASHSCOPE_API_KEY", "builder", "DashScope API key", "Alternative Qwen key name supported by the starter.", undefined, undefined, true),
  field("QWEN_MODEL", "builder", "Qwen model", "Qwen model for builder planning tasks.", undefined, "qwen-plus"),
  field("KIMI_API_KEY", "builder", "Kimi API key", "Enables Kimi verifier/research profiles.", undefined, undefined, true),
  field("MOONSHOT_API_KEY", "builder", "Moonshot API key", "Alternative Kimi key name supported by the starter.", undefined, undefined, true),
  field("KIMI_MODEL", "builder", "Kimi model", "Kimi model for verification tasks.", undefined, "kimi-k2.6"),
  field("BUILDER_DOCUMENT_PARSE_TIMEOUT_MS", "builder", "Document parse timeout", "Max parser time before ingestion fails closed.", undefined, "5000"),
  field("BUILDER_DOCUMENT_INGESTION_QUOTA_PER_IP", "builder", "Document quota", "Max document ingestions per IP in the quota window.", undefined, "20"),
  field("BUILDER_DOCUMENT_INGESTION_QUOTA_WINDOW_MS", "builder", "Document quota window", "Rolling quota window for document ingestion.", undefined, "60000"),
  field("VOYAGE_API_KEY", "knowledge", "Voyage API key", "Enables embeddings for RAG/knowledge search.", undefined, undefined, true),
  field("DATABASE_URL", "knowledge", "Postgres URL", "Postgres/pgvector source of truth.", undefined, undefined, true),
  field("BUILDER_INFRA_APPLY_DRIVER", "infra", "Apply driver", "Dev-local plans by default; external, K3s, and kubectl are opt-in.", ["dev-local", "external", "k3s-docker", "kubectl"], "dev-local"),
  field("BUILDER_INFRA_COMPUTE_TARGET", "infra", "Compute target", "IaC compute target emitted by the planner.", ["local", "k3s", "kubernetes", "managed", "vm"], "local"),
  field("BUILDER_INFRA_TOFU_MODULE_DIR", "infra", "OpenTofu module dir", "Required for the external infra runner.", undefined, undefined, false),
  field("BUILDER_INFRA_K3S_PORT", "infra", "K3s API port", "Local K3s API port exposed through Docker.", undefined, "16443"),
  field("BUILDER_VECTOR_BACKEND", "infra", "Vector backend", "Optional vector backend override.", ["postgres-pgvector", "milvus"], "postgres-pgvector"),
  field("MILVUS_URL", "infra", "Milvus URL", "Optional Milvus endpoint for vector-heavy agents.", undefined, undefined, true),
  field("NEO4J_URI", "infra", "Graph URI", "Optional graph endpoint for graph-ready agents.", undefined, undefined, true),
  field("GRAPH_DATABASE_URL", "infra", "Graph database URL", "Optional Neo4j/Memgraph compatible graph endpoint.", undefined, undefined, true),
  field("AGENT_LEARNING_ENABLED", "infra", "Session learning", "Enables post-session memory and agent version evolution.", ["true", "false"], "true"),
  field("AGENT_LEARNING_WORKFLOW_DRIVER", "infra", "Learning workflow driver", "Use local in-process learning in dev or dispatch to a Temporal worker.", ["local", "temporal"], "local"),
  field("REDIS_URL", "infra", "Redis URL", "Redis temporal memory for learned session facts and user preferences.", undefined, undefined, true),
  field("TEMPORAL_ADDRESS", "infra", "Temporal address", "Temporal workflow endpoint for post-session learning jobs.", undefined, "localhost:7233"),
  field("TEMPORAL_NAMESPACE", "infra", "Temporal namespace", "Temporal namespace used by the learning worker.", undefined, "default"),
  field("TEMPORAL_TASK_QUEUE", "infra", "Temporal task queue", "Task queue consumed by the learning worker.", undefined, "agent-learning"),
  field("TEMPORAL_WORKFLOW_TYPE", "infra", "Temporal workflow type", "Workflow type started for post-session learning.", undefined, "learnFromSession"),
  field("AGENT_LEARNING_MEMORY_TTL_SECONDS", "infra", "Learning TTL", "Redis TTL for temporal learned memory.", undefined, "2592000"),
  field("VOICE_DEV_AUTH_TOKEN", "auth", "Server auth token", "Protects builder and voice websocket routes when set.", undefined, undefined, true),
  field("VITE_VOICE_DEV_AUTH_TOKEN", "auth", "Client auth token", "Browser-side token mirrored for local dev.", undefined, undefined, true),
  field("VOICE_ALLOWED_ORIGINS", "auth", "Allowed origins", "Comma-separated CORS origins for the starter server.", undefined, "http://localhost:5177,http://127.0.0.1:5177"),
];

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
    const value = normalizeValue(rawValue);
    if (value) updates.set(key, value);
    else removals.add(key);
  }

  writeLocalEnv(updates, removals);
  return readOnboardingEnvStore();
}

function field(
  name: string,
  group: EnvFieldGroup,
  label: string,
  description: string,
  options?: string[],
  defaultValue?: string,
  secret = false,
): EnvFieldDefinition {
  return { name, group, label, description, options, defaultValue, secret, restartRequired: true };
}

function readSources() {
  const root = readDotEnv(rootEnvPath);
  const starter = readDotEnv(starterEnvPath);
  const local = readDotEnv(localEnvPath);
  return { root, starter, local, process: Bun.env };
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

function requirementStates(fields: EnvFieldState[]): EnvRequirementState[] {
  return [
    requirement(
      "voice-provider-key",
      "voice",
      "Voice provider key",
      "At least one Gemini or OpenAI key is required to run a voice agent.",
      ["GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY"],
      fields,
      "required",
    ),
    requirement(
      "builder-research-key",
      "builder",
      "Builder research key",
      "At least one DeepSeek or Qwen key is required for builder research/planning quality.",
      ["DEEPSEEK_API_KEY", "QWEN_API_KEY", "DASHSCOPE_API_KEY"],
      fields,
      "required",
    ),
    requirement(
      "knowledge-store",
      "knowledge",
      "Knowledge store",
      "DATABASE_URL and VOYAGE_API_KEY are required for RAG/knowledge compilation.",
      ["DATABASE_URL", "VOYAGE_API_KEY"],
      fields,
      "recommended",
      "all",
    ),
    requirement(
      "learning-runtime",
      "infra",
      "Learning runtime",
      "REDIS_URL and learning workflow settings are required for automatic post-session learning.",
      [
        "REDIS_URL",
        "AGENT_LEARNING_WORKFLOW_DRIVER",
        "TEMPORAL_ADDRESS",
        "TEMPORAL_TASK_QUEUE",
        "TEMPORAL_WORKFLOW_TYPE",
      ],
      fields,
      "recommended",
      "all",
    ),
    requirement(
      "graph-memory",
      "infra",
      "Graph memory backend",
      "Optional: configure DATABASE_URL, NEO4J_URI, or GRAPH_DATABASE_URL for graph memory.",
      ["DATABASE_URL", "NEO4J_URI", "GRAPH_DATABASE_URL"],
      fields,
      "recommended",
    ),
  ];
}

function requirement(
  id: string,
  group: EnvFieldGroup,
  label: string,
  message: string,
  candidateKeys: string[],
  fields: EnvFieldState[],
  severity: EnvRequirementState["severity"],
  mode: "any" | "all" = "any",
): EnvRequirementState {
  const states = candidateKeys.map((key) => fields.find((field) => field.name === key));
  const satisfied = mode === "all"
    ? states.every((field) => field?.configured)
    : states.some((field) => field?.configured);
  return { id, group, label, message, satisfied, severity, candidateKeys, mode };
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

function writeLocalEnv(updates: Map<string, string>, removals: Set<string>) {
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

function normalizeValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function dotEnvValue(value: string): string {
  return /^[A-Za-z0-9_./:@,+-]+$/.test(value)
    ? value
    : JSON.stringify(value);
}

function maskSecret(value: string): string {
  if (value.length <= 8) return "configured";
  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}
