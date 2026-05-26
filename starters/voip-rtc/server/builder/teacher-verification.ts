import type {
  AgentBuildDraft,
  KnowledgeDocument,
  KnowledgeResearchBudget,
  KnowledgeResearchResult,
  KnowledgeVerificationVerdict,
} from "@voiceagentsdk/core/sdk";
import type { BuilderWorkflowDependencies } from "./types.js";

export interface TeacherVerificationInput {
  budget: Partial<KnowledgeResearchBudget>;
  deps: BuilderWorkflowDependencies;
  documents: KnowledgeDocument[];
  draft: AgentBuildDraft;
  research?: KnowledgeResearchResult;
  researchSettings: {
    provider?: string;
    model?: string;
    verifierProvider?: string;
    verifierModel?: string;
    verificationPasses?: number;
  };
}

export interface TeacherVerificationResult {
  documents: KnowledgeDocument[];
  research?: KnowledgeResearchResult;
  steps: Array<{ name: string; status: string; detail?: string }>;
  verdicts: KnowledgeVerificationVerdict[];
}

export async function runTeacherVerification(
  input: TeacherVerificationInput,
): Promise<TeacherVerificationResult> {
  const verifier = input.deps.knowledgeVerifier;
  if (!verifier || !(verifier.isConfigured?.() ?? true)) {
    return {
      documents: input.documents,
      research: input.research,
      steps: [{ name: "kimi-teacher", status: "blocked" }],
      verdicts: [],
    };
  }

  let documents = [...input.documents];
  let research = input.research;
  const steps: TeacherVerificationResult["steps"] = [];
  const verdicts: KnowledgeVerificationVerdict[] = [];
  const verifierProvider = input.researchSettings.verifierProvider ?? "kimi";
  if (verifierProvider !== "kimi") {
    return {
      documents,
      research,
      steps: [{ name: "kimi-teacher", status: "blocked" }],
      verdicts,
    };
  }
  const passCount = Math.min(
    Math.max(
      1,
      input.researchSettings.verificationPasses ||
        input.deps.knowledgeVerificationPasses || 1,
    ),
    8,
  );

  for (let pass = 1; pass <= passCount; pass += 1) {
    const verdict = await verifier.verifyKnowledge({
      draft: input.draft,
      documents,
      research,
      settings: {
        model: input.researchSettings.verifierModel,
        provider: verifierProvider,
      },
    });
    verdicts.push(verdict);
    documents = appendTeacherDocument(documents, input.draft, verdict, pass);
    steps.push({
      name: `kimi-teacher-pass-${pass}`,
      status: verdict.status,
      detail: `${Math.round(verdict.confidence * 100)}% confidence`,
    });

    if (verdict.status !== "needs_more_data") break;
    if (verdict.recommendedQueries.length === 0) break;
    if (!input.deps.research.isConfigured(input.researchSettings)) break;

    const followUp = await input.deps.research.growKnowledge({
      draft: input.draft,
      documents,
      budget: input.budget,
      settings: {
        ...input.researchSettings,
        provider: "deepseek",
        researchIntents: [{
          objective: `Kimi teacher follow-up pass ${pass}`,
          queries: verdict.recommendedQueries,
        }],
      },
    });
    documents = [...documents, ...followUp.documents];
    research = mergeResearch(research, followUp);
    steps.push({
      name: `deepseek-follow-up-${pass}`,
      status: followUp.status,
      detail: followUp.stopReason,
    });
  }

  return { documents, research, steps, verdicts };
}

function appendTeacherDocument(
  documents: KnowledgeDocument[],
  draft: AgentBuildDraft,
  verdict: KnowledgeVerificationVerdict,
  pass: number,
): KnowledgeDocument[] {
  const text = renderTeacherMarkdown(verdict, pass);
  if (!text.trim()) return documents;
  return [
    ...documents,
    {
      id: `doc_kimi_teacher_${crypto.randomUUID()}`,
      name: `${draft.identity.publicAgentName} kimi teacher pass ${pass}.md`,
      kind: "md",
      mimeType: "text/markdown",
      status: "parsed",
      text,
      metadata: {
        provider: "kimi-teacher",
        pass,
        status: verdict.status,
        confidence: verdict.confidence,
        artifactTables: verdict.artifactTables,
        coverageMatrix: verdict.coverageMatrix,
      },
    },
  ];
}

function renderTeacherMarkdown(
  verdict: KnowledgeVerificationVerdict,
  pass: number,
): string {
  return [
    `# Kimi teacher verification pass ${pass}`,
    "",
    `Verdict: ${verdict.status}`,
    `Confidence: ${Math.round(verdict.confidence * 100)}%`,
    section("Reasons", verdict.reasons),
    section("Missing topics", verdict.missingTopics),
    section("Recommended follow-up queries", verdict.recommendedQueries),
    coverageMarkdown(verdict),
    tablesMarkdown(verdict),
    verdict.enrichmentMarkdown ? "## Rich enrichment\n" +
      verdict.enrichmentMarkdown : "",
    section("Warnings", verdict.warnings ?? []),
  ].filter(Boolean).join("\n\n");
}

function section(title: string, items: string[]): string {
  if (items.length === 0) return "";
  return [`## ${title}`, ...items.map((item) => `- ${item}`)].join("\n");
}

function coverageMarkdown(verdict: KnowledgeVerificationVerdict): string {
  const rows = verdict.coverageMatrix ?? [];
  if (rows.length === 0) return "";
  return [
    "## Coverage matrix",
    "| Topic | Status | Evidence | Follow-up |",
    "| --- | --- | --- | --- |",
    ...rows.map((row) =>
      `| ${cell(row.topic)} | ${cell(row.status)} | ${
        cell(row.evidence.join("; "))
      } | ${cell(row.followUp.join("; "))} |`
    ),
  ].join("\n");
}

function tablesMarkdown(verdict: KnowledgeVerificationVerdict): string {
  const tables = verdict.artifactTables ?? [];
  if (tables.length === 0) return "";
  return [
    "## XLSX-ready artifact tables",
    ...tables.map((table) => [
      `### ${table.name}`,
      `Purpose: ${table.purpose}`,
      `Recommended format: ${table.recommendedFormat}`,
      markdownTable(table.columns, table.rows),
    ].join("\n\n")),
  ].join("\n\n");
}

function markdownTable(columns: string[], rows: string[][]): string {
  if (columns.length === 0) return "";
  return [
    `| ${columns.map(cell).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((_, index) => cell(row[index] ?? "")).join(" | ")} |`),
  ].join("\n");
}

function cell(value: string): string {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function mergeResearch(
  previous: KnowledgeResearchResult | undefined,
  next: KnowledgeResearchResult,
): KnowledgeResearchResult {
  if (!previous) return next;
  return {
    ...next,
    documents: [...previous.documents, ...next.documents],
    cycles: [...previous.cycles, ...next.cycles],
    checkpoints: [
      ...(previous.checkpoints ?? []),
      ...(next.checkpoints ?? []),
    ],
    spend: {
      cycles: previous.spend.cycles + next.spend.cycles,
      queries: previous.spend.queries + next.spend.queries,
      sources: previous.spend.sources + next.spend.sources,
      estimatedTokens:
        previous.spend.estimatedTokens + next.spend.estimatedTokens,
      estimatedCostUsd:
        previous.spend.estimatedCostUsd + next.spend.estimatedCostUsd,
    },
    warnings: [...(previous.warnings ?? []), ...(next.warnings ?? [])],
  };
}
