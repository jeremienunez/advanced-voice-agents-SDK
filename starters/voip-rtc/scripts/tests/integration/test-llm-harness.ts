import type {
  KnowledgeVerificationVerdict,
  LlmTask,
} from "@voiceagentsdk/core/sdk";
import { LlmKnowledgeResearch } from "../../../server/builder/adapters/llm/knowledge-research.js";
import { LlmKnowledgeVerifier } from "../../../server/builder/adapters/llm/knowledge-verifier.js";
import { LlmPromptPlanner } from "../../../server/builder/adapters/llm/prompt-planner.js";
import { AdaptiveLlmModelResolver } from "../../../server/builder/llm/resolver.js";
import { assert } from "../shared/assertions.js";
import {
  document,
  draft,
  profile,
  prompts,
  RecordingLlmRunner,
  result,
} from "../fixtures/llm-harness/fixtures.js";
import {
  scenarioResearchCapsCycleOutputToRemainingTokenBudget,
  scenarioResearchCapsCountedQueriesPerCycle,
  scenarioResearchStopsWhenPromptExceedsRemainingTokenBudget,
} from "../fixtures/llm-harness/research-budget-scenarios.js";
import { scenarioPromptDataIsQuotedAsData } from "../fixtures/llm-harness/prompt-boundary-scenarios.js";
import {
  scenarioTeacherFollowUpUsesRemainingResearchBudget,
} from "../fixtures/llm-harness/teacher-budget-scenarios.js";

const results = await Promise.all([
  scenarioPromptPlannerFallsBackWhenJsonIsInvalid(),
  scenarioPromptDataIsQuotedAsData(),
  scenarioResearchCreatesDocumentsAndCheckpoints(),
  scenarioResearchCapsCycleOutputToRemainingTokenBudget(),
  scenarioResearchCapsCountedQueriesPerCycle(),
  scenarioResearchStopsWhenPromptExceedsRemainingTokenBudget(),
  scenarioTeacherFollowUpUsesRemainingResearchBudget(),
  scenarioPromptPlannerUsesBuilderSystemModelSelection(),
  scenarioResearchCycleLimitBoundsFailedIterations(),
  scenarioVerifierNormalizesInvalidVerdicts(),
  scenarioResolverHonorsRequestedModelsAndFallbacks(),
]);

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioPromptPlannerFallsBackWhenJsonIsInvalid() {
  const runner = new RecordingLlmRunner(result({ content: "{not-json" }));
  const planner = new LlmPromptPlanner({ prompts: prompts(), runner });
  const plan = await planner.createPromptPlan({ draft: draft() });
  const task = runner.tasks[0];

  assert(plan.promptPart1.includes("Harness Agent"), "invalid JSON must use fallback prompt plan");
  assert(task.skillRef === "builder.prompt_plan", "planner task skill ref must be stable");
  assert(task.outputContract?.kind === "json_object", "planner must request JSON object output");
  assert(task.requestedModel?.provider === "gemini", "planner must pass requested provider");

  return "prompt-planner-json-fallback";
}

async function scenarioPromptPlannerUsesBuilderSystemModelSelection() {
  const runner = new RecordingLlmRunner(result({ content: "{not-json" }));
  const planner = new LlmPromptPlanner({ prompts: prompts(), runner });
  await planner.createPromptPlan({
    draft: {
      ...draft(),
      builderSystem: {
        modelSelections: {
          "builder.planner": {
            provider: "deepseek",
            model: "deepseek-planner",
          },
        },
      },
    },
  });
  const task = runner.tasks[0];

  assert(
    task.requestedModel?.provider === "deepseek",
    "planner must use builder system provider instead of draft identity",
  );
  assert(
    task.requestedModel?.model === "deepseek-planner",
    "planner must use builder system model instead of draft identity",
  );

  return "prompt-planner-builder-system-model-selection";
}

async function scenarioResearchCreatesDocumentsAndCheckpoints() {
  const runner = new RecordingLlmRunner(result({
    content: "Distilled facts from https://example.com/source.",
    model: "deepseek-test",
    provider: "deepseek",
    totalTokens: 240,
  }));
  const research = new LlmKnowledgeResearch({
    estimatedCostPer1kTokens: 0.01,
    profiles: [profile({ provider: "deepseek", roles: ["builder.researcher"] })],
    prompts: prompts(),
    runner,
  });
  const output = await research.growKnowledge({
    draft: draft(),
    documents: [document()],
    budget: {
      maxCycles: 5,
      maxEstimatedCostUsd: 1,
      maxEstimatedTokens: 2_000,
      maxQueriesPerCycle: 1,
      maxSources: 1,
    },
    settings: {
      provider: "deepseek",
      model: "deepseek-test",
      researchIntents: [{
        objective: "Find official source",
        queries: ["official source"],
      }],
    },
  });

  assert(output.status === "completed", "research with sources must complete");
  assert(output.documents.length === 1, "research must create one document");
  assert(output.documents[0].metadata?.sourceCount === 1, "research document must keep source count");
  assert(output.checkpoints?.some((item) => item.label === "document-created"), "research must expose document checkpoint");
  assert(runner.tasks[0].role === "builder.researcher", "research must call researcher role");

  return "research-document-checkpoints";
}

async function scenarioResearchCycleLimitBoundsFailedIterations() {
  const runner = new FailingLlmRunner();
  const research = new LlmKnowledgeResearch({
    estimatedCostPer1kTokens: 0.01,
    profiles: [profile({ provider: "deepseek", roles: ["builder.researcher"] })],
    prompts: prompts(),
    runner,
  });
  const output = await research.growKnowledge({
    draft: draft(),
    documents: [document()],
    budget: {
      maxCycles: 3,
      maxEstimatedCostUsd: 1,
      maxEstimatedTokens: 20_000,
      maxQueriesPerCycle: 1,
      maxSources: 20,
    },
    settings: {
      provider: "deepseek",
      model: "deepseek-test",
      researchIntents: Array.from({ length: 12 }, (_, index) => ({
        objective: `objective ${index + 1}`,
        queries: [`query ${index + 1}`],
      })),
    },
  });

  assert(output.cycles.length === 3, "research cycles must stop at maxCycles");
  assert(runner.tasks.length === 3, "failed research iterations must still be bounded");
  assert(
    output.stopReason?.includes("cycle limit"),
    `research stop reason must mention cycle limit, got ${output.stopReason ?? "none"}`,
  );

  return "research-cycle-limit-bounds-failed-iterations";
}

async function scenarioVerifierNormalizesInvalidVerdicts() {
  const parsed = {
    status: "invalid-status",
    confidence: 2,
    reasons: ["covered"],
    missingTopics: ["pricing"],
    recommendedQueries: ["pricing source"],
    coverageMatrix: "invalid",
  } as unknown as KnowledgeVerificationVerdict;
  const verifier = new LlmKnowledgeVerifier({
    maxOutputTokens: 1_000,
    profiles: [profile({ provider: "kimi", roles: ["builder.verifier"] })],
    prompts: prompts(),
    runner: new RecordingLlmRunner(result({ content: "{}", parsed })),
  });
  const verdict = await verifier.verifyKnowledge({
    draft: draft(),
    documents: [document()],
    settings: { provider: "kimi", model: "kimi-test" },
  });

  assert(verdict.status === "needs_more_data", "invalid verifier status must fall back");
  assert(verdict.confidence === 1, "verifier confidence must be clamped");
  assert(verdict.coverageMatrix?.length === 0, "invalid coverage matrix must normalize to empty");
  assert(verdict.recommendedQueries[0] === "pricing source", "valid query list must survive normalization");

  return "verifier-verdict-normalization";
}

class FailingLlmRunner {
  readonly tasks: LlmTask[] = [];

  async run(task: LlmTask): Promise<never> {
    this.tasks.push(task);
    throw new Error("research iteration failed");
  }
}

async function scenarioResolverHonorsRequestedModelsAndFallbacks() {
  const resolver = new AdaptiveLlmModelResolver([
    profile({ provider: "deepseek", roles: ["builder.planner"] }),
    profile({ provider: "qwen", roles: ["builder.planner"], jsonSchema: true }),
    profile({
      provider: "gemini",
      roles: ["builder.planner"],
      jsonSchema: true,
      latencyClass: "interactive",
    }),
  ]);
  const requested = resolver.resolveModel(task({
    requestedModel: { provider: "gemini", model: "gemini-custom" },
  }));
  const fallback = resolver.resolveModel(task({
    outputContract: { kind: "json_schema" },
    requestedModel: { provider: "openai", model: "missing" },
  }));

  assert(requested.profile.provider === "gemini", "configured requested provider must win");
  assert(requested.profile.model === "gemini-custom", "requested model override must be preserved");
  assert(requested.providerOptions?.disableThinking === true, "structured output must disable thinking");
  assert(fallback.profile.provider === "qwen", "unconfigured requested provider must fall back to best profile");

  return "resolver-requested-model-fallback";
}

function task(overrides: Partial<LlmTask> = {}): LlmTask {
  return {
    id: "task-a",
    role: "builder.planner",
    intent: "plan",
    skillRef: "test",
    messages: [{ role: "user", content: "test" }],
    outputContract: { kind: "json_object" },
    needs: { latency: "batch", maxOutputTokens: 100 },
    ...overrides,
  };
}
