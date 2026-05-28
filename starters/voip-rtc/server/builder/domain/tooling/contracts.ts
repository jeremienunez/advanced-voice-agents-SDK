import type {
  AgentBuildDraft,
  JsonSchema,
  ToolBuildContract,
  ToolBuildPlan,
  ToolName,
  ToolRegistryItem,
} from "@voiceagentsdk/core/sdk";

type ContractFactory = (item: ToolRegistryItem, selected: boolean) => ToolBuildContract;

export function createToolBuildPlan(
  draft: AgentBuildDraft,
  selectedTools: ToolName[],
): ToolBuildPlan {
  const selected = new Set(selectedTools);
  return {
    id: `tools_${draft.id}`,
    status: "planned",
    selectedToolNames: selectedTools,
    tools: draft.toolRegistry.map((item) => {
      return (contractFactories[item.name] ?? fallbackContract)(item, selected.has(item.name));
    }),
  };
}

const contractFactories: Record<string, ContractFactory> = {
  search_knowledge: (item, selected) => baseContract(item, selected, {
    confirmation: false,
    handlerRef: "knowledge.search",
    parameters: searchParameters(),
    sideEffect: "read",
    requiresKnowledge: true,
  }),
  create_summary: (item, selected) => baseContract(item, selected, {
    confirmation: false,
    handlerRef: "summary.create",
    parameters: summaryParameters(),
    sideEffect: "none",
  }),
  handoff_to_human: (item, selected) => baseContract(item, selected, {
    confirmation: true,
    handlerRef: "handoff.create",
    parameters: handoffParameters(),
    sideEffect: "handoff",
  }),
  schedule_follow_up: (item, selected) => baseContract(item, selected, {
    confirmation: true,
    handlerRef: "task.schedule",
    parameters: followUpParameters(),
    sideEffect: "write",
  }),
  emit_structured_note: (item, selected) => baseContract(item, selected, {
    confirmation: true,
    handlerRef: "event.emit",
    parameters: noteParameters(),
    sideEffect: "write",
  }),
};

function fallbackContract(item: ToolRegistryItem, selected: boolean) {
  return {
    name: item.name,
    title: item.title,
    description: item.description,
    category: item.category,
    permissions: item.permissions,
    parameters: objectSchema({ note: { type: "string" } }, ["note"]),
    sideEffect: "external_action",
    confirmation: {
      required: true,
      reason: "No runtime handler is bound for this tool.",
    },
    runtimeBinding: { handlerRef: "", timeoutMs: 10_000 },
    requiresKnowledge: item.requiresKnowledge,
    requiresGraph: item.requiresGraph,
    requiredSecrets: item.requiredSecrets,
    readiness: selected ? "blocked" : "needs_configuration",
    selected,
    reasons: selected ? ["Selected tool has no runtime handler binding."] : [],
  };
}

function baseContract(
  item: ToolRegistryItem,
  selected: boolean,
  options: {
    confirmation: boolean;
    handlerRef: string;
    parameters: JsonSchema;
    sideEffect: ToolBuildContract["sideEffect"];
    requiresKnowledge?: boolean;
  },
): ToolBuildContract {
  return {
    name: item.name,
    title: item.title,
    description: item.description,
    category: item.category,
    permissions: item.permissions,
    parameters: options.parameters,
    sideEffect: options.sideEffect,
    confirmation: {
      required: options.confirmation,
      reason: options.confirmation ? "External action or write side effect." : undefined,
    },
    runtimeBinding: { handlerRef: options.handlerRef, timeoutMs: 10_000 },
    requiresKnowledge: options.requiresKnowledge ?? item.requiresKnowledge,
    requiresGraph: item.requiresGraph,
    requiredSecrets: item.requiredSecrets,
    readiness: "ready",
    selected,
    reasons: selected ? ["Selected during onboarding."] : [],
  };
}

function searchParameters(): JsonSchema {
  return objectSchema({
    query: { type: "string", description: "Natural language search query." },
    mode: { type: "string", enum: ["hybrid", "lexical", "vector"] },
    limit: { type: "integer", minimum: 1, maximum: 8 },
  }, ["query"]);
}

function summaryParameters(): JsonSchema {
  return objectSchema({
    summary: { type: "string" },
    keyFacts: { type: "array", items: { type: "string" } },
    nextActions: { type: "array", items: { type: "string" } },
  }, ["summary"]);
}

function handoffParameters(): JsonSchema {
  return objectSchema({
    reason: { type: "string" },
    urgency: { type: "string", enum: ["low", "normal", "high"] },
    confirmed: { type: "boolean" },
  }, ["reason", "confirmed"]);
}

function followUpParameters(): JsonSchema {
  return objectSchema({
    topic: { type: "string" },
    dueAt: { type: "string" },
    confirmed: { type: "boolean" },
  }, ["topic", "confirmed"]);
}

function noteParameters(): JsonSchema {
  return objectSchema({
    eventType: { type: "string" },
    payload: { type: "object" },
    confirmed: { type: "boolean" },
  }, ["eventType", "payload", "confirmed"]);
}

function objectSchema(properties: Record<string, JsonSchema>, required: string[]): JsonSchema {
  return { type: "object", properties, required };
}
