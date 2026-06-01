import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createAgentRxDiagnosticReport,
  renderAgentRxReportMarkdown,
  type AgentRxConstraint,
  type AgentRxTrajectory,
  type AgentRxViolation,
} from "@voiceagentsdk/core/sdk";
import {
  AGENTRX_ARTIFACTS,
  AGENTRX_QUALITY_SIGNALS,
} from "../agentrx-diagnostics/manifest.js";
import { writeAgentRxArtifacts } from "../../starters/voip-rtc/scripts/route-wines/agentrx.js";

const results = [
  scenarioQualitySignalsAreDeclaredAndScripted(),
  scenarioSdkReportKeepsAuditableFailureLocalization(),
  scenarioSdkReportSummarizesIterationsAndRecursiveCycles(),
  await scenarioRouteWinesArtifactsArePresentAndNonEmpty(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioQualitySignalsAreDeclaredAndScripted(): string {
  const scripts = packageScripts();
  for (const id of [
    "sdk-typecheck",
    "starter-typecheck",
    "route-wines-harness",
  ]) {
    const signal = AGENTRX_QUALITY_SIGNALS.find((item) => item.id === id);
    assert(signal?.required, `missing required AGENTRX quality signal ${id}`);
    assert(
      rootScriptExists(signal.command, scripts),
      `${id} must point at a real root package script`,
    );
  }
  return "quality-signals-are-declared-and-scripted";
}

function scenarioSdkReportKeepsAuditableFailureLocalization(): string {
  const report = createAgentRxDiagnosticReport({
    trajectory: diagnosticTrajectory(),
    constraints: diagnosticConstraints(),
    violations: diagnosticViolations(),
    recommendation: "Fix the first unrecovered violation before retrying.",
  });
  const markdown = renderAgentRxReportMarkdown(report);

  assert(report.validationLog?.trajectoryId === "bdd-agentrx", "report must keep a validation log");
  assert(report.validationLog.violations.length === 3, "validation log must retain every violation");
  assert(report.criticalFailure?.stepIndex === 1, "critical failure must localize the first unrecovered step");
  assert(
    report.criticalFailure.category === "Misinterpretation of Tool Output",
    "critical failure must carry the taxonomy category",
  );
  assert(markdown.includes("## Critical Failure"), "markdown report must expose the critical failure");
  assert(markdown.includes("Step: 1"), "markdown report must include the critical step");

  return "sdk-report-keeps-auditable-failure-localization";
}

function scenarioSdkReportSummarizesIterationsAndRecursiveCycles(): string {
  const report = createAgentRxDiagnosticReport({
    trajectory: iterativeTrajectory(),
    constraints: [],
    violations: [],
    recommendation: "Break the recursive retry loop before continuing.",
  });
  const repeated = report.iterationSummary?.repeatedActions.find((item) => {
    return item.action === "search_knowledge";
  });

  assert(repeated?.count === 2, "report must count repeated trajectory actions");
  assert(repeated.maxIteration === 2, "report must keep the highest action iteration");
  assert(
    report.iterationSummary?.recursiveCycleDetected === true,
    "report must detect recursive parent cycles iteratively",
  );
  assert(
    report.criticalFailure?.constraintId === "agentrx_trajectory_acyclic",
    "recursive trajectory cycle must become the critical structural failure",
  );
  assert(report.status === "failed", "recursive trajectory cycles must fail the report");

  return "sdk-report-summarizes-iterations-and-recursive-cycles";
}

function iterativeTrajectory(): AgentRxTrajectory {
  return {
    id: "bdd-agentrx-iterations",
    instruction: "Retry search, then recover without entering recursive loops.",
    steps: [
      trajectoryStep(0, "plan", "planner", "select_tool", "completed"),
      {
        ...trajectoryStep(1, "execute", "tool", "search_knowledge", "failed"),
        iteration: 1,
        parentStepIndex: 0,
      },
      {
        ...trajectoryStep(2, "execute", "tool", "search_knowledge", "completed"),
        iteration: 2,
        parentStepIndex: 1,
      },
      {
        ...trajectoryStep(3, "recover", "agent", "retry", "running"),
        parentStepIndex: 4,
      },
      {
        ...trajectoryStep(4, "recover", "agent", "retry", "running"),
        parentStepIndex: 3,
      },
    ],
  };
}

async function scenarioRouteWinesArtifactsArePresentAndNonEmpty(): Promise<string> {
  const directory = mkdtempSync(join(tmpdir(), "agentrx-bdd-"));
  try {
    const telemetryPath = join(directory, "telemetry.ndjson");
    writeFileSync(telemetryPath, telemetryFixture());

    const artifacts = await writeAgentRxArtifacts({
      runId: "route-wines-bdd",
      telemetryPath,
      outputDir: directory,
      summary: routeWinesSummary(directory),
    });

    for (const artifact of AGENTRX_ARTIFACTS) {
      const path = String(artifacts[artifact.summaryKey]);
      assert(path.endsWith(artifact.fileName), `${artifact.id} must use the expected file name`);
      assert(existsSync(path), `${artifact.id} must exist`);
      assert(readFileSync(path, "utf8").trim().length > 0, `${artifact.id} must be non-empty`);
    }

    const report = readJson(String(artifacts.reportPath)) as {
      status?: string;
      criticalFailure?: { constraintId?: string };
    };
    const validationLog = readJson(String(artifacts.validationLogPath)) as {
      trajectoryId?: string;
      violations?: unknown[];
    };
    assert(report.status === "failed", "route-wines AGENTRX report must fail on unrecovered harness violations");
    assert(
      report.criticalFailure?.constraintId === "step_must_complete",
      "route-wines report must localize the failed harness step first",
    );
    assert(validationLog.trajectoryId === "route-wines-bdd", "validation log must identify the trajectory");
    assert(
      Array.isArray(validationLog.violations) && validationLog.violations.length > 0,
      "validation log must include violation evidence",
    );

    return "route-wines-artifacts-are-present-and-non-empty";
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function packageScripts(): Record<string, string> {
  const source = readFileSync("package.json", "utf8");
  return (JSON.parse(source) as { scripts?: Record<string, string> }).scripts ?? {};
}

function rootScriptExists(command: string, scripts: Record<string, string>): boolean {
  const match = command.match(/^pnpm ([a-z0-9:-]+)$/);
  return Boolean(match?.[1] && scripts[match[1]]);
}

function diagnosticTrajectory(): AgentRxTrajectory {
  return {
    id: "bdd-agentrx",
    instruction: "Diagnose a failed agent trajectory.",
    steps: [
      trajectoryStep(0, "plan", "planner", "select_tool", "completed"),
      trajectoryStep(1, "execute", "tool", "read_output", "failed"),
      trajectoryStep(2, "recover", "agent", "retry", "failed"),
    ],
  };
}

function trajectoryStep(
  index: number,
  phase: string,
  actor: string,
  action: string,
  status: "completed" | "failed" | "running",
) {
  return { index, phase, actor, action, status, summary: `${actor}.${action}` };
}

function diagnosticConstraints(): AgentRxConstraint[] {
  return [
    constraint("schema_valid", "SCHEMA"),
    constraint("tool_output_interpreted", "RELATIONAL_POST"),
    constraint("retry_has_new_evidence", "TEMPORAL"),
  ];
}

function constraint(id: string, type: AgentRxConstraint["type"]): AgentRxConstraint {
  return {
    id,
    label: id.replaceAll("_", " "),
    type,
    taxonomyTargets: ["Misinterpretation of Tool Output", "System Failure"],
    checkHint: `${id} must be evaluated step by step.`,
    severity: "high",
  };
}

function diagnosticViolations(): AgentRxViolation[] {
  return [
    violation(0, "schema_valid", "System Failure", true),
    violation(2, "retry_has_new_evidence", "System Failure", false),
    violation(1, "tool_output_interpreted", "Misinterpretation of Tool Output", false),
  ];
}

function violation(
  stepIndex: number,
  constraintId: string,
  category: AgentRxViolation["category"],
  recovered: boolean,
): AgentRxViolation {
  return {
    stepIndex,
    constraintId,
    category,
    severity: "high",
    evidence: `${constraintId} evidence`,
    recovered,
  };
}

function telemetryFixture(): string {
  const events = [
    event("config", "ok"),
    event("autonomous research", "error", "Research provider unavailable."),
    event("compile agent", "ok"),
  ];
  return `${events.map((item) => JSON.stringify(item)).join("\n")}\n`;
}

function event(name: string, status: "ok" | "error", error?: string) {
  return {
    runId: "route-wines-bdd",
    type: "step.end",
    name,
    timestamp: "2026-05-28T10:00:00.000Z",
    durationMs: 1,
    status,
    error,
    data: { name },
  };
}

function routeWinesSummary(directory: string) {
  return {
    summaryPath: join(directory, "summary.json"),
    xlsx: { path: join(directory, "route-des-vins.xlsx") },
    config: { availability: { research: true } },
    research: { status: "completed", documents: ["doc-route-wines"] },
    agent: { draftId: "draft-route-wines" },
  };
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
