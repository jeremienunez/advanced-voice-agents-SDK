import type {
  AgentEvolutionInput,
  AgentEvolutionPort,
  AgentEvolutionResult,
  CompiledAgentArtifact,
} from "@voiceagentsdk/core/sdk";
import { mutateDraft } from "../builder/domain/drafts.js";
import { requireDraft, saveDraft } from "../builder/state/draft-store.js";
import { setActiveDraft } from "../builder/state/session-store.js";
import { decideInfraEvolution } from "./evolution-infra.js";
import { buildPromptVersion } from "./evolution-prompt.js";
import {
  artifactIdFor,
  currentEvolution,
} from "./evolution-state.js";
import type { AgentEvolutionMetadata } from "./evolution-types.js";

export class StarterAgentEvolution implements AgentEvolutionPort {
  async validateAndApply(
    input: AgentEvolutionInput,
  ): Promise<AgentEvolutionResult> {
    const draft = requireDraft(input.draftId);
    if (!draft.compiled) {
      return {
        status: "skipped",
        draftId: draft.id,
        version: currentEvolution(draft).version,
        reason: "Draft is not compiled.",
      };
    }

    const now = new Date().toISOString();
    const current = currentEvolution(draft);
    const nextVersion = current.version + 1;
    const artifactId = artifactIdFor(draft.id, nextVersion);
    const previousArtifactId = current.currentArtifactId ||
      artifactIdFor(draft.id, current.version);
    const prompt = buildPromptVersion(draft.compiled.prompt, input);
    const infraDecision = decideInfraEvolution(input, now);
    const nextArtifact: CompiledAgentArtifact = {
      ...draft.compiled,
      prompt,
      createdAt: now,
    };
    const nextEvolution: AgentEvolutionMetadata = {
      version: nextVersion,
      currentArtifactId: artifactId,
      rollbackArtifactId: previousArtifactId,
      rollbackArtifact: draft.compiled,
      versions: [
        ...current.versions,
        {
          version: nextVersion,
          artifactId,
          runId: input.runId,
          sourceSessionId: input.sourceSessionId,
          createdAt: now,
          reason: "Applied post-session learning.",
        },
      ],
      audits: [
        ...current.audits,
        {
          id: `audit_${crypto.randomUUID()}`,
          runId: input.runId,
          action: "apply",
          fromVersion: current.version,
          toVersion: nextVersion,
          createdAt: now,
          reason: "Auto-applied validated learned memory.",
        },
        ...(infraDecision.pending
          ? [{
              id: `audit_${crypto.randomUUID()}`,
              runId: input.runId,
              action: "pending_infra" as const,
              fromVersion: current.version,
              toVersion: nextVersion,
              createdAt: now,
              reason: "Infra plan evolution is pending approval.",
            }]
          : []),
      ],
      pendingInfraEvolution: infraDecision.pending ?? current.pendingInfraEvolution,
      lastLearningRun: {
        runId: input.runId,
        status: infraDecision.pending ? "applied_pending_infra" : "applied",
        at: now,
        sourceSessionId: input.sourceSessionId,
      },
    };
    const builder = mutateDraft(draft)
      .finalPrompt(prompt)
      .compiled(nextArtifact)
      .metadata({
        agentEvolution: nextEvolution,
        learningMemory: {
          lastRunId: input.runId,
          memoryIds: input.memories.map((memory) => memory.id),
          graphNodeCount: input.graph.nodes.length,
          graphEdgeCount: input.graph.edges.length,
        },
        retrievalWeights: input.recommendations.retrievalWeights ?? {},
      });
    if (infraDecision.applicablePlan) builder.infraPlan(infraDecision.applicablePlan);
    const nextDraft = builder.build();

    saveDraft(nextDraft);
    setActiveDraft(nextDraft.id);
    return {
      status: "applied",
      draftId: nextDraft.id,
      version: nextVersion,
      previousVersion: current.version,
      artifactId,
      rollbackArtifactId: previousArtifactId,
      auditId: nextEvolution.audits.at(-1)?.id,
      reason: infraDecision.pending
        ? "Applied post-session learning; infra plan is pending approval."
        : "Applied post-session learning.",
    };
  }

  async approveInfraEvolution(
    draftId: string,
    pendingId: string,
  ): Promise<AgentEvolutionResult> {
    const draft = requireDraft(draftId);
    const current = currentEvolution(draft);
    const pending = current.pendingInfraEvolution;
    if (!draft.compiled) {
      return {
        status: "skipped",
        draftId,
        version: current.version,
        reason: "Draft is not compiled.",
      };
    }
    if (!pending || pending.id !== pendingId || pending.status !== "pending") {
      return {
        status: "skipped",
        draftId,
        version: current.version,
        reason: "No pending infra evolution is available.",
      };
    }

    const now = new Date().toISOString();
    const nextVersion = current.version + 1;
    const artifactId = artifactIdFor(draft.id, nextVersion);
    const approvedArtifact = { ...draft.compiled, createdAt: now };
    const nextEvolution: AgentEvolutionMetadata = {
      ...current,
      version: nextVersion,
      currentArtifactId: artifactId,
      rollbackArtifactId: current.currentArtifactId,
      rollbackArtifact: draft.compiled,
      pendingInfraEvolution: {
        ...pending,
        status: "approved",
        approvedAt: now,
      },
      versions: [
        ...current.versions,
        {
          version: nextVersion,
          artifactId,
          createdAt: now,
          reason: "Approved pending infra evolution.",
        },
      ],
      audits: [
        ...current.audits,
        {
          id: `audit_${crypto.randomUUID()}`,
          runId: pending.runId,
          action: "approve_infra",
          fromVersion: current.version,
          toVersion: nextVersion,
          createdAt: now,
          reason: "Approved pending infra plan evolution.",
        },
      ],
    };
    const nextDraft = mutateDraft(draft)
      .infraPlan(pending.proposedPlan)
      .compiled(approvedArtifact)
      .metadata({ agentEvolution: nextEvolution })
      .build();

    saveDraft(nextDraft);
    setActiveDraft(nextDraft.id);
    return {
      status: "applied",
      draftId,
      version: nextVersion,
      previousVersion: current.version,
      artifactId,
      rollbackArtifactId: current.currentArtifactId,
      auditId: nextEvolution.audits.at(-1)?.id,
      reason: "Approved pending infra plan evolution.",
    };
  }

  async rollback(draftId: string): Promise<AgentEvolutionResult> {
    const draft = requireDraft(draftId);
    const current = currentEvolution(draft);
    if (!current.rollbackArtifact) {
      return {
        status: "skipped",
        draftId,
        version: current.version,
        reason: "No rollback artifact is available.",
      };
    }

    const now = new Date().toISOString();
    const nextVersion = current.version + 1;
    const artifactId = artifactIdFor(draft.id, nextVersion);
    const rollbackArtifact = {
      ...current.rollbackArtifact,
      createdAt: now,
    };
    const nextEvolution: AgentEvolutionMetadata = {
      ...current,
      version: nextVersion,
      currentArtifactId: artifactId,
      rollbackArtifactId: current.currentArtifactId,
      rollbackArtifact: draft.compiled,
      versions: [
        ...current.versions,
        {
          version: nextVersion,
          artifactId,
          createdAt: now,
          reason: "Rollback to previous compiled artifact.",
        },
      ],
      audits: [
        ...current.audits,
        {
          id: `audit_${crypto.randomUUID()}`,
          action: "rollback",
          fromVersion: current.version,
          toVersion: nextVersion,
          createdAt: now,
          reason: "Manual rollback from Agent Bank.",
        },
      ],
    };
    const nextDraft = mutateDraft(draft)
      .finalPrompt(rollbackArtifact.prompt)
      .compiled(rollbackArtifact)
      .metadata({ agentEvolution: nextEvolution })
      .build();

    saveDraft(nextDraft);
    setActiveDraft(nextDraft.id);
    return {
      status: "applied",
      draftId,
      version: nextVersion,
      previousVersion: current.version,
      artifactId,
      rollbackArtifactId: current.currentArtifactId,
      auditId: nextEvolution.audits.at(-1)?.id,
      reason: "Rolled back to previous compiled artifact.",
    };
  }
}
