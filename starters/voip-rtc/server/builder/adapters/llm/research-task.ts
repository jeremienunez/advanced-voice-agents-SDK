import type {
  KnowledgeResearchRequest,
  LlmTask,
} from "@voiceagentsdk/core/sdk";

export function createLlmResearchTask(
  input: KnowledgeResearchRequest,
  objective: { objective: string; queries: string[] },
  system: string,
  user: string,
  provider: string | undefined,
  model: string | undefined,
  maxOutputTokens: number,
): LlmTask {
  return {
    id: `builder.research:${input.draft.id}:${crypto.randomUUID()}`,
    role: "builder.researcher",
    intent: input.draft.identity.intent,
    skillRef: "builder.research",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    outputContract: { kind: "text" },
    requestedModel: { provider, model },
    needs: {
      cost: "quality",
      latency: "batch",
      maxOutputTokens,
      reasoning: "adaptive",
      tools: "none",
    },
    metadata: {
      draftId: input.draft.id,
      objective: objective.objective,
      queryCount: objective.queries.length,
    },
  };
}
