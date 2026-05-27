import type {
  AgentBuildDraft,
  KnowledgeDocument,
  LlmModelCapabilities,
  LlmModelProfile,
  LlmTask,
  LlmTaskResult,
  LlmTaskRole,
  LlmTaskRunnerPort,
} from "@voiceagentsdk/core/sdk";
import type { BuilderPromptLibrary } from "../../server/builder/prompts/template.js";

type RunnerResponse =
  | LlmTaskResult<unknown>
  | ((task: LlmTask) => LlmTaskResult<unknown>);

const capabilities: LlmModelCapabilities = {
  chat: true,
  structuredOutput: true,
  jsonSchema: false,
  toolCalling: true,
  streaming: false,
  reasoning: true,
  reasoningBudget: false,
  realtimeAudio: false,
};

export class RecordingLlmRunner implements LlmTaskRunnerPort {
  readonly tasks: LlmTask[] = [];

  constructor(private readonly response: RunnerResponse) {}

  async run<TOutput = unknown>(task: LlmTask): Promise<LlmTaskResult<TOutput>> {
    this.tasks.push(task);
    const response = typeof this.response === "function"
      ? this.response(task)
      : this.response;
    return { ...response, taskId: task.id } as LlmTaskResult<TOutput>;
  }
}

export function prompts(): BuilderPromptLibrary {
  const pair = { system: "system", user: "{{draftJson}}{{documentsJson}}{{objective}}" };
  return {
    promptPlan: pair,
    knowledgePlan: pair,
    toolPlan: pair,
    finalPrompt: pair,
    databasePlan: pair,
    research: pair,
    knowledgeVerification: pair,
  };
}

export function draft(): AgentBuildDraft {
  const now = new Date(0).toISOString();
  return {
    id: "draft-llm",
    status: "draft",
    identity: {
      builderFirstName: "Harness",
      builderLastName: "Tester",
      publicAgentName: "Harness Agent",
      intent: "Help users compare reliable source material",
      mustDo: ["cite sources"],
      mustNotDo: ["invent facts"],
      llmProvider: "gemini",
      llmModel: "gemini-requested",
    },
    toolRegistry: [],
    selectedTools: [],
    promptParts: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function document(): KnowledgeDocument {
  return {
    id: "doc-a",
    name: "source.md",
    kind: "md",
    status: "parsed",
    text: "Reliable source material about the domain.",
  };
}

export function profile(input: {
  configured?: boolean;
  jsonSchema?: boolean;
  latencyClass?: LlmModelProfile["latencyClass"];
  model?: string;
  provider: string;
  roles: LlmTaskRole[];
}): LlmModelProfile {
  const model = input.model ?? `${input.provider}-model`;
  return {
    id: `${input.provider}:${model}`,
    provider: input.provider,
    model,
    label: input.provider,
    roles: input.roles,
    configured: input.configured ?? true,
    capabilities: {
      ...capabilities,
      jsonSchema: input.jsonSchema ?? false,
    },
    latencyClass: input.latencyClass ?? "batch",
  };
}

export function result(input: {
  content: string;
  model?: string;
  parsed?: unknown;
  provider?: string;
  totalTokens?: number;
}): LlmTaskResult<unknown> {
  return {
    taskId: "pending",
    provider: input.provider ?? "fake",
    model: input.model ?? "fake-model",
    content: input.content,
    parsed: input.parsed,
    usage: input.totalTokens ? { totalTokens: input.totalTokens } : undefined,
  };
}
