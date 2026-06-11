import type {
  AgentBuildDraft,
  AgentEvolutionInput,
  AuthTicketIdentity,
  FinalPromptBuildRequest,
  PromptPlannerPort,
  ToolName,
} from "@voiceagentsdk/core/sdk";
import { runtimeToolHandlerRefs } from "../../../server/runtime/tools/handler-refs.js";
import { StarterAgentEvolution } from "../../../server/learning/evolution.js";
import { getDraft, saveDraft } from "../../../server/builder/state/draft-store.js";
import type { BuilderWorkflowDependencies } from "../../../server/builder/types.js";
import { createBuilderWorkflows } from "../../../server/builder/workflows.js";
import { assert } from "../shared/assertions.js";

const policyEnd = "END SERVER-OWNED SAFETY AND TOOL POLICY";
const owner = identity("tenant-learning", "user-learning");

const results = [
  await scenarioLearningKeepsServerPolicyFinal(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioLearningKeepsServerPolicyFinal() {
  const draft = draftForLearningPolicy("draft_learning_policy_bdd");
  saveDraft(draft);

  const workflows = createBuilderWorkflows({
    availableSecretNames: [],
    availableToolHandlerRefs: runtimeToolHandlerRefs(),
    planner: promptPlanner(),
  } as unknown as BuilderWorkflowDependencies);

  const { artifact } = await workflows.compileAgent({
    draftId: draft.id,
    selectedTools: ["create_summary"],
  }, { identity: owner });
  assert(
    artifact.prompt.trim().endsWith(policyEnd),
    "compiled prompt must start with server policy as final suffix",
  );

  const evolution = new StarterAgentEvolution();
  const result = await evolution.validateAndApply(learningInput(draft.id));
  const evolved = getDraft(draft.id)?.compiled?.prompt ?? "";

  assert(result.status === "applied", "learning must apply to compiled draft");
  assert(
    evolved.includes("## Learned Session Memory"),
    "learned memory block must be inserted",
  );
  assert(
    evolved.indexOf("## Learned Session Memory") <
      evolved.lastIndexOf("BEGIN SERVER-OWNED SAFETY AND TOOL POLICY"),
    "learned memory must be placed before the server-owned policy",
  );
  assert(
    evolved.trim().endsWith(policyEnd),
    "server-owned policy must remain the final suffix after learning",
  );

  return "learning-preserves-server-owned-policy-suffix";
}

function promptPlanner(): Pick<PromptPlannerPort, "composeFinalPrompt"> {
  return {
    async composeFinalPrompt(
      _input: FinalPromptBuildRequest,
    ): Promise<string> {
      return [
        "Identity and goal: Policy Agent helps users safely test learning.",
        "Presence and atmosphere: concise, grounded, and deliberate.",
        "Voice style: short spoken turns, one question at a time.",
        "Conversation policy: confirm before external actions and state uncertainty.",
        "Knowledge policy: use retrieved context before factual domain answers.",
        "Tool policy: use create_summary only for summarizing validated context.",
        "Boundaries and escalation: escalate when context or permission is unclear.",
        "Success criteria: the user gets a safe next step.",
      ].join("\n");
    },
  };
}

function draftForLearningPolicy(id: string): AgentBuildDraft {
  const now = new Date(0).toISOString();
  return {
    id,
    status: "draft",
    identity: {
      builderFirstName: "Policy",
      builderLastName: "Learning",
      publicAgentName: "Policy Agent",
      intent: "Test learning policy preservation",
      mustDo: [],
      mustNotDo: [],
    },
    promptPlan: {
      questions: [],
      assumptions: [],
      promptPart1: "Base prompt",
      doRules: [],
      dontRules: [],
      recommendedVoice: {
        provider: "gemini",
        voice: "Puck",
        tone: "clear",
        rationale: "test",
      },
    },
    toolRegistry: [{
      name: "create_summary" as ToolName,
      title: "Create summary",
      description: "Summarize validated context.",
      category: "test",
      permissions: ["summary:create"],
    }],
    selectedTools: ["create_summary"],
    promptParts: {},
    createdAt: now,
    updatedAt: now,
    metadata: { builderOwner: owner },
  };
}

function learningInput(draftId: string): AgentEvolutionInput {
  return {
    runId: "learn-policy-bdd",
    draftId,
    agentId: draftId,
    sourceSessionId: "session-policy-bdd",
    memories: [{
      id: "memory-policy-bdd",
      scope: { tenantId: "tenant-a", agentId: draftId, userId: "user-a" },
      kind: "summary",
      text: "The user prefers concise answers.",
      sourceSessionId: "session-policy-bdd",
      createdAt: new Date(0).toISOString(),
    }],
    graph: { nodes: [], edges: [] },
    recommendations: { retrievalWeights: { temporal: 0.7 } },
  };
}

function identity(tenantId: string, userId: string): AuthTicketIdentity {
  return { tenantId, userId, scopes: ["builder:access"] };
}
