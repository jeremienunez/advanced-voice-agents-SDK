import type {
  AgentRxConstraint,
  AgentRxDiagnosticReport,
  AgentRxTrajectory,
  AgentRxViolation,
} from "../types/diagnostics.js";
import {
  agentRxStructuralConstraints,
  agentRxStructuralViolations,
  summarizeAgentRxIterations,
} from "./iterations.js";
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
  const iterationSummary = summarizeAgentRxIterations(input.trajectory);
  const structuralViolations = agentRxStructuralViolations(iterationSummary);
  const violations = uniqueViolations([
    ...input.violations,
    ...structuralViolations,
  ]);
  const constraints = uniqueConstraints([
    ...input.constraints,
    ...agentRxStructuralConstraints(iterationSummary),
  ]);
  const criticalFailure = firstUnrecoveredViolation(violations);
  return {
    trajectoryId: input.trajectory.id,
    generatedAt,
    taxonomyVersion: AGENTRX_TAXONOMY_VERSION,
    status: reportStatus(criticalFailure),
    trajectory: input.trajectory.steps,
    constraints,
    violations,
    iterationSummary,
    validationLog: {
      trajectoryId: input.trajectory.id,
      violations,
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

function uniqueConstraints(
  constraints: AgentRxConstraint[],
): AgentRxConstraint[] {
  const seen = new Set<string>();
  return constraints.filter((constraint) => {
    if (seen.has(constraint.id)) return false;
    seen.add(constraint.id);
    return true;
  });
}

function uniqueViolations(
  violations: AgentRxViolation[],
): AgentRxViolation[] {
  const seen = new Set<string>();
  return violations.filter((violation) => {
    const key = [
      violation.stepIndex,
      violation.constraintId,
      violation.category,
      violation.evidence,
    ].join("\u0000");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
