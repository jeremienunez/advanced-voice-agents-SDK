import type {
  KnowledgeResearchBudget,
  KnowledgeResearchRequest,
  KnowledgeResearchResult,
  KnowledgeVerifierPort,
} from "@voiceagentsdk/core/sdk";
import { runTeacherVerification } from "../../server/builder/teacher-verification.js";
import { assert } from "../shared/assertions.js";
import { document, draft } from "./fixtures.js";

export async function scenarioTeacherFollowUpUsesRemainingResearchBudget() {
  let captured: KnowledgeResearchRequest | undefined;
  const previous = researchResult({
    cycles: 1,
    queries: 4,
    sources: 5,
    estimatedTokens: 8_000,
    estimatedCostUsd: 0.01,
  });

  const result = await runTeacherVerification({
    budget: {
      maxCycles: 5,
      maxEstimatedCostUsd: 0.25,
      maxEstimatedTokens: 12_000,
      maxQueriesPerCycle: 4,
      maxSources: 10,
    },
    deps: {
      knowledgeVerificationModel: "kimi-test",
      knowledgeVerificationPasses: 1,
      knowledgeVerificationProvider: "kimi",
      knowledgeVerifier: verifierWithFollowUpQueries(10),
      research: {
        isConfigured: () => true,
        async growKnowledge(input: KnowledgeResearchRequest) {
          captured = input;
          return researchResult({
            cycles: 1,
            queries: input.settings?.researchIntents?.[0]?.queries.length ?? 0,
            sources: 2,
            estimatedTokens: 1_000,
            estimatedCostUsd: 0.002,
          }, input.budget as KnowledgeResearchBudget);
        },
      },
    } as any,
    documents: [document()],
    draft: draft(),
    research: previous,
    researchSettings: {
      model: "deepseek-test",
      provider: "deepseek",
      verifierModel: "kimi-test",
      verifierProvider: "kimi",
      verificationPasses: 1,
    },
  });

  const followUp = captured;
  assert(followUp, "teacher verification must request one follow-up research pass");
  assert(followUp.budget, "teacher follow-up must receive a bounded budget");
  const followUpBudget = followUp.budget;
  assert(
    followUpBudget.maxSources === 5,
    `teacher follow-up must receive remaining source budget, got ${followUpBudget.maxSources}`,
  );
  assert(
    followUpBudget.maxEstimatedTokens === 4_000,
    `teacher follow-up must receive remaining token budget, got ${followUpBudget.maxEstimatedTokens}`,
  );
  assert(
    followUpBudget.maxCycles === 4,
    `teacher follow-up must receive remaining cycle budget, got ${followUpBudget.maxCycles}`,
  );
  assert(
    followUp.settings?.researchIntents?.[0]?.queries.length === 4,
    `teacher follow-up queries must be capped per cycle, got ${followUp.settings?.researchIntents?.[0]?.queries.length ?? "none"}`,
  );
  assert(
    result.research?.budget.maxEstimatedTokens === 12_000,
    `merged research must keep the global token budget, got ${result.research?.budget.maxEstimatedTokens ?? "none"}`,
  );
  assert(
    result.research?.spend.estimatedTokens === 9_000,
    `merged research spend must accumulate previous and follow-up tokens, got ${result.research?.spend.estimatedTokens ?? "none"}`,
  );

  return "teacher-follow-up-uses-remaining-research-budget";
}

function verifierWithFollowUpQueries(count: number): KnowledgeVerifierPort {
  return {
    isConfigured: () => true,
    async verifyKnowledge() {
      return {
        status: "needs_more_data",
        confidence: 0.4,
        reasons: ["needs more coverage"],
        missingTopics: ["coverage"],
        recommendedQueries: Array.from({ length: count }, (_, index) =>
          `follow-up ${index + 1}`
        ),
        coverageMatrix: [],
        artifactTables: [],
      };
    },
  };
}

function researchResult(
  spend = {
    cycles: 0,
    queries: 0,
    sources: 0,
    estimatedTokens: 0,
    estimatedCostUsd: 0,
  },
  budget: KnowledgeResearchBudget = {
    maxCycles: 5,
    maxEstimatedCostUsd: 0.25,
    maxEstimatedTokens: 12_000,
    maxQueriesPerCycle: 4,
    maxSources: 10,
  },
): KnowledgeResearchResult {
  return {
    status: "completed",
    budget,
    spend,
    documents: [],
    cycles: [],
    checkpoints: [],
    stopReason: "test",
    warnings: [],
  };
}
