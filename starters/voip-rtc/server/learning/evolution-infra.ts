import type {
  AgentEvolutionInput,
  AgentInfraPlan,
} from "@voiceagentsdk/core/sdk";
import type { PendingInfraEvolution } from "./evolution-types.js";

export interface InfraEvolutionDecision {
  applicablePlan?: AgentInfraPlan;
  pending?: PendingInfraEvolution;
}

export function decideInfraEvolution(
  input: AgentEvolutionInput,
  createdAt: string,
): InfraEvolutionDecision {
  const proposedPlan = input.recommendations.infraPlan;
  if (!proposedPlan) return {};

  const approvalReasons = approvalReasonsFor(proposedPlan);
  if (approvalReasons.length === 0) {
    return { applicablePlan: proposedPlan };
  }

  return {
    pending: {
      id: `pending_infra_${crypto.randomUUID()}`,
      runId: input.runId,
      sourceSessionId: input.sourceSessionId,
      status: "pending",
      proposedPlan,
      approvalReasons,
      createdAt,
    },
  };
}

function approvalReasonsFor(plan: AgentInfraPlan): string[] {
  const reasons: string[] = [];
  if (plan.computeTarget !== "local") {
    reasons.push(`compute target ${plan.computeTarget} requires approval`);
  }
  if (plan.migrationPolicy.requiresApproval) {
    reasons.push("migration policy requires approval");
  }
  if (plan.provisioningMode === "external" || plan.provisioningMode === "iac_plan") {
    reasons.push(`provisioning mode ${plan.provisioningMode} requires approval`);
  }
  if (plan.storePlan?.guardrails.destructiveInfraMigrations === "approval_required") {
    reasons.push("destructive infra migration guardrail requires approval");
  }
  return reasons;
}
