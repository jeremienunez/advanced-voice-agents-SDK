import type {
  AgentRxConstraint,
  AgentRxDiagnosticReport,
  AgentRxTrajectory,
  AgentRxViolation,
} from "../types.js";
import { AGENTRX_TAXONOMY_VERSION } from "./taxonomy.js";

export interface AgentRxReportInput {
  trajectory: AgentRxTrajectory;
  constraints: AgentRxConstraint[];
  violations: AgentRxViolation[];
  recommendation?: string;
}

export function createAgentRxDiagnosticReport(
  input: AgentRxReportInput,
): AgentRxDiagnosticReport {
  const generatedAt = new Date().toISOString();
  const criticalFailure = firstUnrecoveredViolation(input.violations);
  return {
    trajectoryId: input.trajectory.id,
    generatedAt,
    taxonomyVersion: AGENTRX_TAXONOMY_VERSION,
    status: reportStatus(criticalFailure),
    trajectory: input.trajectory.steps,
    constraints: input.constraints,
    violations: input.violations,
    validationLog: {
      trajectoryId: input.trajectory.id,
      violations: input.violations,
      generatedAt,
    },
    criticalFailure,
    recommendation: input.recommendation,
  };
}

export function firstUnrecoveredViolation(
  violations: AgentRxViolation[],
): AgentRxViolation | undefined {
  return [...violations]
    .sort((left, right) => {
      if (left.stepIndex !== right.stepIndex) return left.stepIndex - right.stepIndex;
      return severityRank(right) - severityRank(left);
    })
    .find((violation) => !violation.recovered);
}

function reportStatus(violation: AgentRxViolation | undefined) {
  if (!violation) return "healthy";
  return violation.severity === "high" ? "failed" : "watch";
}

function severityRank(violation: AgentRxViolation): number {
  if (violation.severity === "high") return 3;
  if (violation.severity === "medium") return 2;
  return 1;
}
