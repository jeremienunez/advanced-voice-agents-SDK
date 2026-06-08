import { LlmKnowledgeResearch } from "../../../../server/builder/adapters/llm/knowledge-research.js";
import { assert } from "../../shared/assertions.js";
import {
  document,
  draft,
  profile,
  prompts,
  RecordingLlmRunner,
  result,
} from "./fixtures.js";

export async function scenarioResearchCapsCycleOutputToRemainingTokenBudget() {
  let callCount = 0;
  const runner = new RecordingLlmRunner(() => {
    callCount += 1;
    return result({
      content: "Distilled facts from https://example.com/source.",
      model: "deepseek-test",
      provider: "deepseek",
      totalTokens: callCount === 1 ? 3_000 : 1_000,
    });
  });
  const research = new LlmKnowledgeResearch({
    estimatedCostPer1kTokens: 0.01,
    profiles: [profile({ provider: "deepseek", roles: ["builder.researcher"] })],
    prompts: prompts(),
    runner,
  });

  await research.growKnowledge({
    draft: draft(),
    documents: [document()],
    budget: {
      maxCycles: 2,
      maxEstimatedCostUsd: 1,
      maxEstimatedTokens: 5_000,
      maxQueriesPerCycle: 1,
      maxSources: 10,
    },
    settings: {
      provider: "deepseek",
      model: "deepseek-test",
      researchIntents: [
        { objective: "Find source one", queries: ["official one"] },
        { objective: "Find source two", queries: ["official two"] },
      ],
    },
  });

  const secondMaxOutput = runner.tasks[1]?.needs?.maxOutputTokens;
  assert(
    typeof secondMaxOutput === "number" && secondMaxOutput <= 2_000,
    `second research cycle must use remaining token budget, got ${secondMaxOutput ?? "none"}`,
  );

  return "research-caps-cycle-output-to-remaining-token-budget";
}

export async function scenarioResearchStopsWhenPromptExceedsRemainingTokenBudget() {
  const runner = new RecordingLlmRunner(result({
    content: "Distilled facts from https://example.com/source.",
    model: "deepseek-test",
    provider: "deepseek",
    totalTokens: 1_998,
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
      maxCycles: 2,
      maxEstimatedCostUsd: 1,
      maxEstimatedTokens: 2_000,
      maxQueriesPerCycle: 1,
      maxSources: 10,
    },
    settings: {
      provider: "deepseek",
      model: "deepseek-test",
      researchIntents: [
        { objective: "Find source one", queries: ["official one"] },
        { objective: "Find source two", queries: ["official two"] },
      ],
    },
  });

  assert(
    runner.tasks.length === 1,
    "research must not start a cycle when the prompt cannot fit remaining token budget",
  );
  assert(
    output.stopReason?.includes("token budget"),
    `research stop reason must explain token budget exhaustion, got ${output.stopReason ?? "none"}`,
  );

  return "research-stops-when-prompt-exceeds-remaining-token-budget";
}

export async function scenarioResearchCapsCountedQueriesPerCycle() {
  const runner = new RecordingLlmRunner(result({
    content: "Distilled facts from https://example.com/source.",
    model: "deepseek-test",
    provider: "deepseek",
    totalTokens: 1_000,
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
      maxCycles: 1,
      maxEstimatedCostUsd: 1,
      maxEstimatedTokens: 5_000,
      maxQueriesPerCycle: 4,
      maxSources: 10,
    },
    settings: {
      provider: "deepseek",
      model: "deepseek-test",
      researchIntents: [{
        objective: "Find official sources",
        queries: Array.from({ length: 10 }, (_, index) => `query ${index + 1}`),
      }],
    },
  });

  assert(
    output.spend.queries === 4,
    `research spend must count capped per-cycle queries, got ${output.spend.queries}`,
  );
  assert(
    output.cycles[0]?.queries.length === 4,
    `research cycle must store capped queries, got ${output.cycles[0]?.queries.length ?? "none"}`,
  );

  return "research-caps-counted-queries-per-cycle";
}
