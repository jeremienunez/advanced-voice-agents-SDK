import type {
  AgentRxConstraint,
  AgentRxDiagnosticReport,
  AgentRxTrajectory,
  AgentRxTrajectoryStep,
  AgentRxViolation,
} from "@voiceagentsdk/core/sdk";
import { createAgentRxDiagnosticReport } from "@voiceagentsdk/core/sdk";
import type {
  AgentBuildDraft,
  KnowledgeDocument,
  KnowledgeResearchResult,
} from "./builder.js";

export function diagnoseBuilderTrajectory(input: {
  draft: AgentBuildDraft | null;
  documents: KnowledgeDocument[];
  researchReport: KnowledgeResearchResult | null;
  knowledgeBlocked: boolean;
  researchBlocked: boolean;
  databaseReady: boolean;
}): AgentRxDiagnosticReport {
  const trajectory = builderTrajectory(input);
  const constraints = builderConstraints();
  const violations = evaluateViolations(input);

  return createAgentRxDiagnosticReport({
    trajectory,
    constraints,
    violations,
    recommendation: builderRecommendation(violations),
  });
}

function builderTrajectory(input: {
  draft: AgentBuildDraft | null;
  documents: KnowledgeDocument[];
  researchReport: KnowledgeResearchResult | null;
  databaseReady: boolean;
}): AgentRxTrajectory {
  const { draft, documents, researchReport, databaseReady } = input;
  return {
    id: draft?.id ?? "builder-draft-not-created",
    instruction: draft?.identity.intent ?? "Build a voice agent.",
    steps: [
      step(0, "identity", "builder-ui", "collect_identity", draft ? "completed" : "running"),
      step(1, "prompt", "builder-llm", "compose_prompt_plan", draft?.promptPlan ? "completed" : "pending"),
      step(2, "prompt", "builder", "confirm_clarifications", promptStatus(draft)),
      step(3, "knowledge", "research-llm", "grow_knowledge", researchStatus(documents, researchReport)),
      step(4, "knowledge", "builder-llm", "plan_rag_strategy", draft?.knowledgePlan ? "completed" : "pending"),
      step(5, "database", "postgres", "apply_isolated_schema", databaseReady ? "completed" : "pending"),
      step(6, "compile", "sdk", "compile_voice_agent", draft?.compiled ? "completed" : "pending"),
    ],
    metadata: {
      documentCount: documents.length,
      researchStatus: researchReport?.status ?? "not-started",
    },
  };
}

function step(
  index: number,
  phase: string,
  actor: string,
  action: string,
  status: AgentRxTrajectoryStep["status"],
): AgentRxTrajectoryStep {
  return { index, phase, actor, action, status, summary: `${actor}.${action}` };
}

function promptStatus(draft: AgentBuildDraft | null) {
  if (!draft?.promptPlan) return "pending";
  return draft.promptPlan.questions.length === 0 ? "completed" : "running";
}

function researchStatus(
  documents: KnowledgeDocument[],
  report: KnowledgeResearchResult | null,
) {
  if (documents.length > 0) return "completed";
  if (report?.status === "failed") return "failed";
  return report ? "running" : "pending";
}

function builderConstraints(): AgentRxConstraint[] {
  return [
    {
      id: "prompt_questions_resolved_before_knowledge",
      label: "Prompt clarifications resolved",
      type: "TEMPORAL",
      taxonomyTargets: ["Underspecified User Intent"],
      checkHint: "Knowledge planning starts only after remaining prompt questions are answered or accepted.",
    },
    {
      id: "knowledge_sources_or_research_required",
      label: "Knowledge source acquisition",
      type: "PROVENANCE",
      taxonomyTargets: ["Instruction/Plan Adherence Failure", "System Failure"],
      checkHint: "If no upload exists, autonomous DeepSeek research must create the first knowledge documents.",
    },
    {
      id: "research_budget_must_hold",
      label: "Research budget adherence",
      type: "PROTOCOL",
      taxonomyTargets: ["Instruction/Plan Adherence Failure"],
      checkHint: "Research spend must stay inside cycle, source, token, and cost budgets.",
    },
    {
      id: "knowledge_plan_requires_documents",
      label: "RAG plan grounded in documents",
      type: "PROVENANCE",
      taxonomyTargets: ["Invention of New Information"],
      checkHint: "A knowledge plan must be grounded in uploaded or researched documents.",
    },
    {
      id: "builder_provider_policy",
      label: "Builder provider role policy",
      type: "CAPABILITY",
      taxonomyTargets: ["Instruction/Plan Adherence Failure"],
      checkHint: "Builder providers must be selected by role/capability; Gemini is allowed for planning but voice runtime remains capability-gated.",
    },
  ];
}

function evaluateViolations(input: {
  draft: AgentBuildDraft | null;
  documents: KnowledgeDocument[];
  researchReport: KnowledgeResearchResult | null;
  researchBlocked: boolean;
  knowledgeBlocked: boolean;
}): AgentRxViolation[] {
  const violations: AgentRxViolation[] = [];
  const { draft, documents, researchReport } = input;

  if (draft?.promptPlan?.questions.length) {
    violations.push(violation(2, "prompt_questions_resolved_before_knowledge", "Underspecified User Intent", "medium", `${draft.promptPlan.questions.length} prompt questions still open.`));
  }
  if (draft?.promptPlan && documents.length === 0 && input.researchBlocked) {
    violations.push(violation(3, "knowledge_sources_or_research_required", "System Failure", "high", "No uploaded document and DeepSeek research provider is unavailable."));
  }
  if (researchReport && exceedsBudget(researchReport)) {
    violations.push(violation(3, "research_budget_must_hold", "Instruction/Plan Adherence Failure", "high", "Research spend exceeded the configured budget."));
  }
  if (draft?.knowledgePlan && documents.length === 0) {
    violations.push(violation(4, "knowledge_plan_requires_documents", "Invention of New Information", "high", "Knowledge plan exists without uploaded or researched documents."));
  }
  if (draft?.knowledgePlan && input.knowledgeBlocked) {
    violations.push(violation(5, "knowledge_sources_or_research_required", "System Failure", "medium", "Knowledge store is not configured for compilation."));
  }
  return violations;
}

function violation(
  stepIndex: number,
  constraintId: string,
  category: AgentRxViolation["category"],
  severity: AgentRxViolation["severity"],
  evidence: string,
): AgentRxViolation {
  return { stepIndex, constraintId, category, severity, evidence };
}

function exceedsBudget(report: KnowledgeResearchResult): boolean {
  return report.spend.cycles > report.budget.maxCycles ||
    report.spend.sources > report.budget.maxSources ||
    report.spend.estimatedTokens > report.budget.maxEstimatedTokens ||
    report.spend.estimatedCostUsd > report.budget.maxEstimatedCostUsd;
}

function builderRecommendation(violations: AgentRxViolation[]): string {
  if (violations.length === 0) {
    return "Continue the builder flow; no unrecovered AGENTRX violation was found.";
  }
  const first = violations[0];
  if (first.constraintId === "knowledge_sources_or_research_required") {
    return "Configure DeepSeek research or upload a source document before planning the knowledge base.";
  }
  return "Resolve the first unrecovered violation before compiling the agent.";
}
