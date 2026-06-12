import type {
  EnvFieldGroup,
  EnvFieldState,
  EnvRequirementState,
} from "./env-types.js";

export function requirementStates(fields: EnvFieldState[]): EnvRequirementState[] {
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
        "AGENT_LEARNING_MEMORY_DRIVER",
        "AGENT_LEARNING_MEMORY_NAMESPACE",
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
      "Optional: configure DATABASE_URL, NEO4J_URI, MEMGRAPH_URI, or GRAPH_DATABASE_URL for graph memory.",
      ["DATABASE_URL", "NEO4J_URI", "MEMGRAPH_URI", "GRAPH_DATABASE_URL"],
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
