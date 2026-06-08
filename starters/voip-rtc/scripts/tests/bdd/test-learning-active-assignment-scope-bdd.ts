import type {
  ActiveAgentAssignmentPort,
  ActiveAgentScope,
  AgentBuildDraft,
  AgentEvolutionInput,
  AgentInfraPlan,
  CompiledAgentArtifact,
} from "@voiceagentsdk/core/sdk";
import { appendServerOwnedPromptPolicy } from "../../../server/builder/domain/prompt/policy.js";
import { saveDraft, requireDraft } from "../../../server/builder/state/draft-store.js";
import { asRecord } from "../../../server/builder/utils/record-readers.js";
import { StarterAgentEvolution } from "../../../server/learning/evolution.js";
import { assert } from "../shared/assertions.js";

const results = [
  await scenarioApproveInfraUsesDraftOwnerScope(),
  await scenarioRollbackUsesDraftOwnerScope(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioApproveInfraUsesDraftOwnerScope(): Promise<string> {
  const calls: Array<ActiveAgentScope & { draftId: string }> = [];
  const draft = compiledDraft("draft_learning_scope_approve");
  saveDraft(draft);
  const evolution = new StarterAgentEvolution({
    activeAgentAssignment: recordingAssignment(calls),
  });
  await evolution.validateAndApply(evolutionInput(draft.id));
  calls.length = 0;

  const pending = pendingInfra(requireDraft(draft.id));
  await evolution.approveInfraEvolution(draft.id, pending.id);

  assert(calls.length === 1, "approve infra must update active assignment once");
  assertScoped(calls[0], draft.id);
  return "approve-infra-uses-draft-owner-scope";
}

async function scenarioRollbackUsesDraftOwnerScope(): Promise<string> {
  const calls: Array<ActiveAgentScope & { draftId: string }> = [];
  const draft = compiledDraft("draft_learning_scope_rollback");
  saveDraft({
    ...draft,
    metadata: {
      ...draft.metadata,
      agentEvolution: {
        version: 2,
        currentArtifactId: `artifact_${draft.id}_v2`,
        rollbackArtifactId: `artifact_${draft.id}_v1`,
        rollbackArtifact: draft.compiled,
        versions: [],
        audits: [],
      },
    },
  });
  const evolution = new StarterAgentEvolution({
    activeAgentAssignment: recordingAssignment(calls),
  });

  await evolution.rollback(draft.id);

  assert(calls.length === 1, "rollback must update active assignment once");
  assertScoped(calls[0], draft.id);
  return "rollback-uses-draft-owner-scope";
}

function compiledDraft(id: string): AgentBuildDraft {
  const now = new Date(0).toISOString();
  const draft: AgentBuildDraft = {
    id,
    status: "compiled",
    identity: {
      builderFirstName: "Scope",
      builderLastName: "Tester",
      publicAgentName: "Scoped Learning Agent",
      intent: "Validate scoped active assignment",
      mustDo: [],
      mustNotDo: [],
      llmProvider: "gemini",
      llmModel: "gemini-test",
    },
    infraPlan: infraPlan(id, "baseline-plan", false),
    toolRegistry: [],
    selectedTools: [],
    promptParts: { final: "Base prompt." },
    metadata: {
      builderOwner: {
        tenantId: "tenant-scope",
        userId: "user-scope",
        planId: "plan-scope",
      },
    },
    createdAt: now,
    updatedAt: now,
  };
  const prompt = appendServerOwnedPromptPolicy("Base prompt.", draft, []);
  return {
    ...draft,
    promptParts: { final: prompt },
    compiled: compiledArtifact(id, prompt),
  };
}

function evolutionInput(draftId: string): AgentEvolutionInput {
  return {
    runId: `run_${draftId}`,
    draftId,
    agentId: draftId,
    sourceSessionId: `session_${draftId}`,
    memories: [],
    graph: { nodes: [], edges: [] },
    recommendations: {
      infraPlan: infraPlan(draftId, "managed-plan", true),
      prompt: "Keep approved infra changes scoped.",
    },
  };
}

function infraPlan(draftId: string, id: string, requiresApproval: boolean): AgentInfraPlan {
  return {
    id,
    draftId,
    status: "validated",
    computeTarget: requiresApproval ? "managed" : "local",
    isolation: requiresApproval ? "dedicated_cluster" : "dedicated_database",
    provisioningMode: requiresApproval ? "external" : "server_template",
    defaultBackendId: "postgres-main",
    database: {
      id: "postgres-main",
      provider: "postgres-pgvector",
      configured: true,
      namespace: `${draftId}_knowledge`,
      schemaName: `${draftId}_knowledge`,
      provisioningMode: requiresApproval ? "external" : "server_template",
      isolation: "dedicated_database",
      reason: "BDD infra plan",
    },
    knowledgeBackends: [],
    resources: [],
    migrationPolicy: {
      source: requiresApproval ? "external" : "server_owned_templates",
      allowGeneratedSql: false,
      requiresApproval,
      notes: [],
    },
    security: {
      tenantScoped: true,
      leastPrivilegeRole: true,
      secretRefs: [],
      networkPolicy: requiresApproval ? "private_network" : "local_only",
    },
    reasons: ["BDD infra recommendation"],
  };
}

function compiledArtifact(draftId: string, prompt: string): CompiledAgentArtifact {
  return {
    draftId,
    sdkDefinition: {
      tenants: [],
      providers: [],
      mediaBridges: [],
      plans: [],
      prompts: [],
      tools: [],
      databases: [],
      stores: [],
      onboarding: [],
      packs: [],
    },
    prompt,
    toolRegistry: [],
    selectedTools: [],
    createdAt: new Date(0).toISOString(),
  };
}

function recordingAssignment(
  calls: Array<ActiveAgentScope & { draftId: string }>,
): ActiveAgentAssignmentPort {
  return {
    getActiveAgent: () => undefined,
    setActiveAgent: (input) => {
      calls.push(input);
    },
  };
}

function assertScoped(
  input: ActiveAgentScope & { draftId: string },
  draftId: string,
): void {
  assert(input.draftId === draftId, "active assignment must keep draft id");
  assert(input.tenantId === "tenant-scope", "active assignment must keep tenant scope");
  assert(input.userId === "user-scope", "active assignment must keep user scope");
  assert(input.planId === "plan-scope", "active assignment must keep plan scope");
}

function pendingInfra(draft: AgentBuildDraft): Record<string, any> {
  const pending = asRecord(asRecord(draft.metadata?.agentEvolution).pendingInfraEvolution);
  assert(pending.id, "pending infra evolution must exist");
  return pending as Record<string, any>;
}
