import type {
  EmbeddingPort,
  KnowledgeSearchMode,
  KnowledgeSearchPort,
} from "@voiceagentsdk/core/sdk";
import type { VoiceSessionTool } from "@voiceagentsdk/core/server";
import type { RuntimeCompiledAgent } from "./compiled-agent.js";
import { hasKnowledgeTool } from "./knowledge-policy.js";

export interface RuntimeKnowledgeToolDeps {
  embeddings: EmbeddingPort;
  embeddingAvailable: boolean;
  search: KnowledgeSearchPort;
  getAgent: (draftId: string | undefined) => RuntimeCompiledAgent | undefined;
}

export function runtimeKnowledgeTools(
  draftId: string | undefined,
  deps: RuntimeKnowledgeToolDeps,
): VoiceSessionTool[] {
  const agent = deps.getAgent(draftId);
  if (
    !deps.search.isConfigured() ||
    !agent ||
    !hasKnowledgeTool(agent.selectedTools)
  ) {
    return [];
  }

  const tool = knowledgeTool(agent, deps);
  return agent.selectedTools.includes("answer_from_knowledge")
    ? [tool, legacyKnowledgeTool(tool)]
    : [tool];
}

function knowledgeTool(
  agent: RuntimeCompiledAgent,
  deps: RuntimeKnowledgeToolDeps,
): VoiceSessionTool {
  return {
    type: "function",
    name: "search_knowledge",
    description:
      "Search the compiled agent knowledge base for grounded context and citations.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language search query.",
        },
        mode: {
          type: "string",
          enum: ["hybrid", "lexical", "vector"],
          description: "Use hybrid by default; lexical for exact names.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 8,
          description: "Maximum number of chunks to return.",
        },
      },
      required: ["query"],
    },
    policy: {
      sideEffect: "read",
      executionMode: "explicit",
      timeoutMs: 10_000,
    },
    execute: async (args) => {
      const query = readString(args.query);
      if (!query) return { status: "empty", reason: "query is required" };
      const requestedMode = readMode(args.mode);
      const mode = deps.embeddingAvailable ? requestedMode : "lexical";
      const embedding = mode === "lexical"
        ? undefined
        : (await deps.embeddings.embed([{ id: "query", text: query }]))[0]?.values;
      return deps.search.search({
        scope: agent.knowledgeScope,
        query,
        mode,
        limit: readLimit(args.limit),
        embedding,
      });
    },
  };
}

function legacyKnowledgeTool(tool: VoiceSessionTool): VoiceSessionTool {
  return {
    ...tool,
    name: "answer_from_knowledge",
    description: `${tool.description} Legacy alias for older compiled agents.`,
  };
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readMode(value: unknown): KnowledgeSearchMode {
  return value === "lexical" || value === "vector" || value === "hybrid"
    ? value
    : "hybrid";
}

function readLimit(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 4;
}
