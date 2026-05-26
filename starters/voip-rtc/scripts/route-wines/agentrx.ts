import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  AgentRxConstraint,
  AgentRxTrajectory,
  AgentRxViolation,
} from "@voiceagentsdk/core/sdk";
import { asRecord, readArray, readPath, slugify } from "./records.js";
import type { JsonRecord, TelemetryEvent } from "./types.js";

export async function writeAgentRxArtifacts(input: {
  runId: string;
  telemetryPath: string;
  outputDir: string;
  summary: JsonRecord;
}): Promise<JsonRecord> {
  const sdk = await import("@voiceagentsdk/core/sdk");
  const trajectory = buildTrajectory(input);
  const violations = buildViolations(trajectory, input.summary);
  const report = sdk.createAgentRxDiagnosticReport({
    trajectory,
    constraints: routeWineConstraints(),
    violations,
    recommendation: recommendation(violations),
  });
  const paths = {
    trajectoryPath: join(input.outputDir, "trajectory-ir.json"),
    validationLogPath: join(input.outputDir, "validation-log.json"),
    reportPath: join(input.outputDir, "agentrx-report.json"),
    markdownPath: join(input.outputDir, "agentrx-report.md"),
  };
  writeFileSync(paths.trajectoryPath, json(trajectory));
  writeFileSync(paths.validationLogPath, json(report.validationLog));
  writeFileSync(paths.reportPath, json(report));
  writeFileSync(paths.markdownPath, sdk.renderAgentRxReportMarkdown(report));
  return {
    ...paths,
    status: report.status,
    criticalFailure: report.criticalFailure ?? null,
  };
}

function buildTrajectory(input: {
  runId: string;
  telemetryPath: string;
  summary: JsonRecord;
}): AgentRxTrajectory {
  const steps = readTelemetryEvents(input.telemetryPath)
    .filter((event) => event.type === "step.end")
    .map((event, index) => ({
      index,
      phase: stepPhase(event.name),
      actor: stepActor(event.name),
      action: slugify(event.name).replaceAll("-", "_"),
      status: event.status === "error" ? "failed" as const : "completed" as const,
      summary: event.error ?? event.name,
      evidence: asRecord(event.data),
    }));
  return {
    id: input.runId,
    instruction: "Build and validate a route-des-vins voice agent.",
    steps,
    metadata: {
      summaryPath: readPath(input.summary, ["summaryPath"]),
      xlsxPath: readPath(input.summary, ["xlsx", "path"]),
    },
  };
}

function buildViolations(
  trajectory: AgentRxTrajectory,
  summary: JsonRecord,
): AgentRxViolation[] {
  const violations = failedStepViolations(trajectory);
  if (!readPath(summary, ["config", "availability", "research"])) {
    violations.push(v(stepIndex(trajectory, "config"), "deepseek_research_configured", "System Failure", "high", "DeepSeek research is not configured."));
  }
  if (readPath(summary, ["research", "status"]) === "failed") {
    violations.push(v(stepIndex(trajectory, "autonomous_research"), "research_cycle_completes", "System Failure", "high", "Autonomous research returned failed."));
  }
  if (readArray(readPath(summary, ["research", "documents"])).length === 0) {
    violations.push(v(stepIndex(trajectory, "autonomous_research"), "knowledge_growth_creates_documents", "Instruction/Plan Adherence Failure", "high", "Research produced no knowledge document."));
  }
  if (!readPath(summary, ["agent", "draftId"])) {
    violations.push(v(stepIndex(trajectory, "compile_agent"), "agent_compiles_for_rtc", "System Failure", "high", "No compiled RTC agent artifact was produced."));
  }
  return violations;
}

function routeWineConstraints(): AgentRxConstraint[] {
  return [
    constraint("deepseek_research_configured", "CAPABILITY", "DeepSeek must be configured for builder knowledge work."),
    constraint("research_cycle_completes", "PROTOCOL", "Each research cycle must finish or expose a failed checkpoint."),
    constraint("knowledge_growth_creates_documents", "PROVENANCE", "Research or upload must create source-backed documents."),
    constraint("agent_compiles_for_rtc", "TEMPORAL", "The harness must compile an agent before RTC tests."),
  ];
}

function constraint(
  id: string,
  type: AgentRxConstraint["type"],
  checkHint: string,
): AgentRxConstraint {
  return {
    id,
    label: id.replaceAll("_", " "),
    type,
    taxonomyTargets: ["Instruction/Plan Adherence Failure", "System Failure"],
    checkHint,
    severity: "high",
  };
}

function failedStepViolations(trajectory: AgentRxTrajectory): AgentRxViolation[] {
  return trajectory.steps
    .filter((step) => step.status === "failed")
    .map((step) => v(step.index, "step_must_complete", "System Failure", "high", step.summary));
}

function v(
  stepIndex: number,
  constraintId: string,
  category: AgentRxViolation["category"],
  severity: AgentRxViolation["severity"],
  evidence: string,
): AgentRxViolation {
  return { stepIndex, constraintId, category, severity, evidence };
}

function stepIndex(trajectory: AgentRxTrajectory, action: string): number {
  return trajectory.steps.find((step) => step.action === action)?.index ?? 0;
}

function readTelemetryEvents(path: string): TelemetryEvent[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TelemetryEvent);
}

function stepPhase(name: string): string {
  if (name.includes("database") || name.includes("db")) return "database";
  if (name.includes("knowledge") || name.includes("research")) return "knowledge";
  if (name.includes("agent") || name.includes("rtc")) return "runtime";
  return "builder";
}

function stepActor(name: string): string {
  if (name.includes("research") || name.includes("plan")) return "deepseek";
  if (name.includes("database") || name.includes("db")) return "postgres";
  if (name.includes("rtc")) return "gemini";
  return "harness";
}

function recommendation(violations: AgentRxViolation[]): string {
  return violations.length === 0
    ? "Harness run is ready for RTC validation."
    : "Inspect the first violation and rerun the harness after the fix.";
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
