import type {
  AgentRxConstraint,
  AgentRxIterationSummary,
  AgentRxTrajectory,
  AgentRxTrajectoryStep,
  AgentRxViolation,
} from "../types/diagnostics.js";

const acyclicConstraintId = "agentrx_trajectory_acyclic";
const parentConstraintId = "agentrx_parent_step_exists";

export function summarizeAgentRxIterations(
  trajectory: AgentRxTrajectory,
): AgentRxIterationSummary {
  const repeatedActions = repeatedActionSummary(trajectory.steps);
  const recursion = recursionSummary(trajectory.steps);
  return {
    repeatedActions,
    maxIteration: repeatedActions.reduce(
      (max, item) => Math.max(max, item.maxIteration),
      maxExplicitIteration(trajectory.steps),
    ),
    maxRecursionDepth: recursion.maxDepth,
    recursiveCycleDetected: recursion.cycleDetected,
    invalidParentStepIndexes: recursion.invalidParentStepIndexes,
  };
}

export function agentRxStructuralConstraints(
  summary: AgentRxIterationSummary,
): AgentRxConstraint[] {
  const constraints: AgentRxConstraint[] = [];
  if (summary.recursiveCycleDetected) {
    constraints.push(structuralConstraint(
      acyclicConstraintId,
      "Trajectory parent links must stay acyclic.",
    ));
  }
  if (summary.invalidParentStepIndexes.length > 0) {
    constraints.push(structuralConstraint(
      parentConstraintId,
      "Every parent step reference must target an existing step.",
    ));
  }
  return constraints;
}

export function agentRxStructuralViolations(
  summary: AgentRxIterationSummary,
): AgentRxViolation[] {
  const violations: AgentRxViolation[] = [];
  if (summary.recursiveCycleDetected) {
    violations.push({
      stepIndex: 0,
      constraintId: acyclicConstraintId,
      category: "System Failure",
      severity: "high",
      evidence: "Trajectory parentStepIndex links contain a recursive cycle.",
    });
  }
  if (summary.invalidParentStepIndexes.length > 0) {
    violations.push({
      stepIndex: summary.invalidParentStepIndexes[0] ?? 0,
      constraintId: parentConstraintId,
      category: "System Failure",
      severity: "high",
      evidence: `Invalid parentStepIndex on steps: ${summary.invalidParentStepIndexes.join(", ")}`,
    });
  }
  return violations;
}

function repeatedActionSummary(steps: AgentRxTrajectoryStep[]) {
  const groups = new Map<
    string,
    { phase: string; actor: string; action: string; count: number; maxIteration: number }
  >();
  for (const step of steps) {
    const current = groups.get(step.action) ?? {
      phase: step.phase,
      actor: step.actor,
      action: step.action,
      count: 0,
      maxIteration: 0,
    };
    current.count += 1;
    current.maxIteration = Math.max(
      current.maxIteration,
      validIteration(step.iteration) ?? current.count,
    );
    groups.set(step.action, current);
  }
  return Array.from(groups.values()).filter((item) => item.count > 1);
}

function recursionSummary(steps: AgentRxTrajectoryStep[]) {
  const byIndex = new Map(steps.map((step) => [step.index, step]));
  const invalidParentStepIndexes: number[] = [];
  let cycleDetected = false;
  let maxDepth = 0;

  for (const step of steps) {
    const seen = new Set<number>();
    let current: AgentRxTrajectoryStep | undefined = step;
    let depth = 0;
    while (current?.parentStepIndex !== undefined) {
      if (seen.has(current.index)) {
        cycleDetected = true;
        break;
      }
      seen.add(current.index);
      const parent = byIndex.get(current.parentStepIndex);
      if (!parent) {
        invalidParentStepIndexes.push(step.index);
        break;
      }
      depth += 1;
      current = parent;
      if (depth > steps.length) {
        cycleDetected = true;
        break;
      }
    }
    maxDepth = Math.max(maxDepth, depth);
  }

  return { cycleDetected, invalidParentStepIndexes, maxDepth };
}

function maxExplicitIteration(steps: AgentRxTrajectoryStep[]): number {
  return steps.reduce((max, step) => {
    return Math.max(max, validIteration(step.iteration) ?? 0);
  }, 0);
}

function validIteration(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function structuralConstraint(
  id: string,
  checkHint: string,
): AgentRxConstraint {
  return {
    id,
    label: id.replaceAll("_", " "),
    type: "TEMPORAL",
    taxonomyTargets: ["System Failure"],
    checkHint,
    severity: "high",
  };
}
