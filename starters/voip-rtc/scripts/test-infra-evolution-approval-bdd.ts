import type {
  AgentBuildDraft,
  AgentEvolutionInput,
  AgentInfraPlan,
  CompiledAgentArtifact,
  InfraComputeTarget,
  InfraProvisioningMode,
} from "@voiceagentsdk/core/sdk";
import { requireDraft, saveDraft } from "../server/builder/state/draft-store.js";
import { asRecord } from "../server/builder/utils/record-readers.js";
import { StarterAgentEvolution } from "../server/learning/evolution.js";
import { assert } from "./shared/assertions.js";

const results = [
  await scenarioRiskyInfraEvolutionRequiresApproval(),
  await scenarioApprovalAppliesPendingInfraPlan(),
  await scenarioLocalInfraEvolutionCanApplyImmediately(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioRiskyInfraEvolutionRequiresApproval(): Promise<string> {
  const draft = compiledDraft("draft_infra_pending");
  saveDraft(draft);
  const evolution = new StarterAgentEvolution();
  const proposed = infraPlan(draft.id, "managed-plan", "managed", "external", true);

  const result = await evolution.validateAndApply(evolutionInput(draft.id, proposed));
  const updated = requireDraft(draft.id);
  const pending = pendingInfra(updated);
  const audits = evolutionAudits(updated);

  assert(result.status === "applied", "prompt learning must still apply when infra is pending");
  assert(updated.infraPlan?.id === "baseline-plan", "risky infra plan must not replace current plan automatically");
  assert(pending.status === "pending", "risky infra plan must be persisted as pending");
  assert(pending.proposedPlan.id === "managed-plan", "pending infra must retain proposed plan");
  const reasons = pending.approvalReasons as string[];
  assert(reasons.some((reason) => reason.includes("managed")), "pending reasons must mention cloud target");
  assert(
    audits.some((audit) => audit.action === "pending_infra"),
    "pending infra evolution must be audited",
  );

  return "risky-infra-evolution-requires-approval";
}

async function scenarioApprovalAppliesPendingInfraPlan(): Promise<string> {
  const draft = compiledDraft("draft_infra_approval");
  saveDraft(draft);
  const evolution = new StarterAgentEvolution();
  const proposed = infraPlan(draft.id, "approved-managed-plan", "managed", "external", true);
  await evolution.validateAndApply(evolutionInput(draft.id, proposed));
  const pending = pendingInfra(requireDraft(draft.id));

  const result = await evolution.approveInfraEvolution(draft.id, pending.id);
  const approved = requireDraft(draft.id);
  const approvedPending = pendingInfra(approved);
  const audits = evolutionAudits(approved);

  assert(result.status === "applied", "approval must apply the pending infra plan");
  assert(approved.infraPlan?.id === "approved-managed-plan", "approval must replace current infra plan");
  assert(approvedPending.status === "approved", "pending infra must record approval status");
  assert(approvedPending.approvedAt, "approval timestamp must be stored");
  assert(
    audits.some((audit) => audit.action === "approve_infra"),
    "approved infra evolution must be audited",
  );
  assert(result.previousVersion === 2 && result.version === 3, "approval must append an evolution version");

  return "approval-applies-pending-infra-plan";
}

async function scenarioLocalInfraEvolutionCanApplyImmediately(): Promise<string> {
  const draft = compiledDraft("draft_infra_local_apply");
  saveDraft(draft);
  const evolution = new StarterAgentEvolution();
  const proposed = infraPlan(draft.id, "local-plan-v2", "local", "server_template", false);

  const result = await evolution.validateAndApply(evolutionInput(draft.id, proposed));
  const updated = requireDraft(draft.id);

  assert(result.status === "applied", "safe local infra plan should apply with learning");
  assert(updated.infraPlan?.id === "local-plan-v2", "safe local infra plan must replace current plan");
  assert(!asRecord(updated.metadata?.agentEvolution).pendingInfraEvolution, "safe local infra must not create pending approval");

  return "local-infra-evolution-can-apply-immediately";
}

function compiledDraft(id: string): AgentBuildDraft {
  const now = new Date(0).toISOString();
  const infra = infraPlan(id, "baseline-plan", "local", "server_template", false);
  return {
    id,
    status: "compiled",
    identity: {
      builderFirstName: "Infra",
      builderLastName: "Evolution",
      publicAgentName: "Infra Evolution Agent",
      intent: "Validate infra evolution approvals",
      mustDo: [],
      mustNotDo: [],
      llmProvider: "gemini",
      llmModel: "gemini-test",
    },
    infraPlan: infra,
    toolRegistry: [],
    selectedTools: [],
    promptParts: { final: "Base prompt." },
    compiled: compiledArtifact(id, "Base prompt."),
    createdAt: now,
    updatedAt: now,
  };
}

function evolutionInput(draftId: string, infra: AgentInfraPlan): AgentEvolutionInput {
  return {
    runId: `run_${draftId}`,
    draftId,
    agentId: draftId,
    sourceSessionId: `session_${draftId}`,
    memories: [{
      id: `mem_${draftId}`,
      kind: "summary",
      text: "Session summary: learned infra requirement.",
      sourceSessionId: `session_${draftId}`,
      scope: { tenantId: "tenant-a", agentId: draftId, userId: "user-a" },
      createdAt: new Date(0).toISOString(),
    }],
    graph: { nodes: [], edges: [] },
    recommendations: {
      infraPlan: infra,
      prompt: "Prefer explicitly approved infra changes.",
      retrievalWeights: { temporal: 0.4, graph: 0.2, knowledge: 0.4 },
    },
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

function infraPlan(
  draftId: string,
  id: string,
  computeTarget: InfraComputeTarget,
  provisioningMode: InfraProvisioningMode,
  requiresApproval: boolean,
): AgentInfraPlan {
  return {
    id,
    draftId,
    status: "validated",
    computeTarget,
    isolation: computeTarget === "local" ? "dedicated_database" : "dedicated_cluster",
    provisioningMode,
    defaultBackendId: "postgres-main",
    database: {
      id: "postgres-main",
      provider: "postgres-pgvector",
      configured: true,
      namespace: `${draftId}_knowledge`,
      schemaName: `${draftId}_knowledge`,
      provisioningMode,
      isolation: "dedicated_database",
      reason: "BDD infra plan",
    },
    knowledgeBackends: [],
    resources: [],
    migrationPolicy: {
      source: provisioningMode === "server_template" ? "server_owned_templates" : "external",
      allowGeneratedSql: false,
      requiresApproval,
      notes: requiresApproval ? ["requires manual approval"] : [],
    },
    security: {
      tenantScoped: true,
      leastPrivilegeRole: true,
      secretRefs: [],
      networkPolicy: computeTarget === "local" ? "local_only" : "private_network",
    },
    reasons: ["BDD infra recommendation"],
  };
}

function pendingInfra(draft: AgentBuildDraft): Record<string, any> {
  const pending = asRecord(asRecord(draft.metadata?.agentEvolution).pendingInfraEvolution);
  assert(pending.id, "pending infra evolution must exist");
  return pending as Record<string, any>;
}

function evolutionAudits(draft: AgentBuildDraft): Array<Record<string, any>> {
  const audits = asRecord(draft.metadata?.agentEvolution).audits;
  assert(Array.isArray(audits), "evolution audits must be present");
  return audits as Array<Record<string, any>>;
}
