import type { AgentRxDiagnosticReport } from "../types/diagnostics.js";

export function renderAgentRxReportMarkdown(
  report: AgentRxDiagnosticReport,
): string {
  const lines = [
    "# AGENTRX Diagnostic Report",
    "",
    `- Status: ${report.status}`,
    `- Trajectory: ${report.trajectoryId ?? "unknown"}`,
    `- Generated: ${report.generatedAt ?? "unknown"}`,
    `- Taxonomy: ${report.taxonomyVersion ?? "unknown"}`,
    "",
    "## Critical Failure",
    "",
    criticalFailureMarkdown(report),
    "",
    "## Violations",
    "",
    ...violationLines(report),
    "",
    "## Iterations",
    "",
    ...iterationLines(report),
    "",
    "## Trajectory",
    "",
    ...report.trajectory.map((step) => {
      return `- ${step.index}. ${step.phase} / ${step.actor}.${step.action}: ${step.status}`;
    }),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function iterationLines(report: AgentRxDiagnosticReport): string[] {
  const summary = report.iterationSummary;
  if (!summary) return ["No iteration summary."];
  const lines = [
    `- Max iteration: ${summary.maxIteration}`,
    `- Max recursion depth: ${summary.maxRecursionDepth}`,
    `- Recursive cycle detected: ${summary.recursiveCycleDetected ? "yes" : "no"}`,
  ];
  if (summary.repeatedActions.length === 0) {
    return [...lines, "- Repeated actions: none"];
  }
  return [
    ...lines,
    "- Repeated actions:",
    ...summary.repeatedActions.map((item) => {
      return `  - ${item.action}: ${item.count} runs, max iteration ${item.maxIteration}`;
    }),
  ];
}

function criticalFailureMarkdown(report: AgentRxDiagnosticReport): string {
  if (!report.criticalFailure) {
    return "No unrecovered violation was detected.";
  }
  const failure = report.criticalFailure;
  return [
    `- Step: ${failure.stepIndex}`,
    `- Category: ${failure.category}`,
    `- Constraint: ${failure.constraintId}`,
    `- Severity: ${failure.severity}`,
    `- Evidence: ${failure.evidence}`,
  ].join("\n");
}

function violationLines(report: AgentRxDiagnosticReport): string[] {
  if (report.violations.length === 0) return ["No violations."];
  return report.violations.map((violation) => {
    return `- step ${violation.stepIndex} [${violation.severity}] ${violation.category}: ${violation.evidence}`;
  });
}
