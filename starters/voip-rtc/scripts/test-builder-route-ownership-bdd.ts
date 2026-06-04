import type {
  AgentBuildDraft,
  AuthTicketIdentity,
  FinalPromptBuildRequest,
  KnowledgeBuildRequest,
  PromptPlannerPort,
} from "@voiceagentsdk/core/sdk";
import { mutateDraft } from "../server/builder/domain/drafts.js";
import { appendServerOwnedPromptPolicy } from "../server/builder/domain/prompt-policy.js";
import { createBuilderRouter } from "../server/builder/router.js";
import { saveDraft } from "../server/builder/state/draft-store.js";
import type {
  BuilderConfig,
  BuilderWorkflowDependencies,
} from "../server/builder/types.js";
import { createBuilderWorkflows } from "../server/builder/workflows.js";
import { agentDraft } from "./solid-seams/fixtures.js";
import { assert } from "./shared/assertions.js";

const results = [
  await scenarioOwnerCanGetKnowledgeDocument(),
  await scenarioCrossOwnerGetDraftRejected(),
  await scenarioCrossOwnerGetKnowledgeDocumentRejected(),
  await scenarioCrossOwnerSessionRejected(),
  await scenarioCrossOwnerPromptClarificationsRejected(),
  await scenarioCrossOwnerRunResearchRejected(),
  await scenarioCrossOwnerKnowledgePlanRejected(),
  await scenarioCrossOwnerCompileAgentRejected(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioOwnerCanGetKnowledgeDocument(): Promise<string> {
  const draft = saveOwnedDraft("route_owner_get_document");
  const document = draft.knowledgePlan?.documents[0];
  assert(document, "fixture must include a knowledge document");
  const response = await route(
    "GET",
    `/builder/drafts/${draft.id}/documents/${document.id}`,
    undefined,
    identity("tenant-a", "user-a"),
  );
  const payload = await response.json() as { document?: { id?: string; text?: string } };
  assert(
    response.status === 200,
    `owner document read must succeed, got ${response.status}`,
  );
  assert(
    payload.document?.id === document.id,
    "document route must return the requested document",
  );
  assert(
    payload.document?.text === "Owned knowledge document body.",
    "document route must preserve document text",
  );
  return "owner-get-knowledge-document";
}

async function scenarioCrossOwnerGetDraftRejected(): Promise<string> {
  const draft = saveOwnedDraft("route_owner_get_draft");
  const response = await route("GET", `/builder/drafts/${draft.id}`);
  await assertRejected(response, "GET /builder/drafts/:id");
  return "cross-owner-get-draft-rejected";
}

async function scenarioCrossOwnerGetKnowledgeDocumentRejected(): Promise<string> {
  const draft = saveOwnedDraft("route_owner_get_document_rejected");
  const document = draft.knowledgePlan?.documents[0];
  assert(document, "fixture must include a knowledge document");
  const response = await route(
    "GET",
    `/builder/drafts/${draft.id}/documents/${document.id}`,
  );
  await assertRejected(response, "GET /builder/drafts/:id/documents/:documentId");
  return "cross-owner-get-knowledge-document-rejected";
}

async function scenarioCrossOwnerSessionRejected(): Promise<string> {
  const draft = saveOwnedDraft("route_owner_session");
  const response = await route("POST", "/builder/session", { draftId: draft.id });
  await assertRejected(response, "POST /builder/session");
  return "cross-owner-session-rejected";
}

async function scenarioCrossOwnerPromptClarificationsRejected(): Promise<string> {
  const draft = saveOwnedDraft("route_owner_prompt_clarifications");
  const response = await route("POST", "/builder/prompt-clarifications", {
    draft: hostileDraft(draft),
    draftId: draft.id,
    answers: { q1: "hostile answer" },
  });
  await assertRejected(response, "POST /builder/prompt-clarifications");
  return "cross-owner-prompt-clarifications-rejected";
}

async function scenarioCrossOwnerRunResearchRejected(): Promise<string> {
  const draft = saveOwnedDraft("route_owner_research");
  const response = await route("POST", "/builder/run-research", {
    draft: hostileDraft(draft),
    draftId: draft.id,
  });
  await assertRejected(response, "POST /builder/run-research");
  return "cross-owner-run-research-rejected";
}

async function scenarioCrossOwnerKnowledgePlanRejected(): Promise<string> {
  const draft = saveOwnedDraft("route_owner_knowledge_plan");
  const response = await route("POST", "/builder/knowledge-plan", {
    draft: hostileDraft(draft),
    draftId: draft.id,
  });
  await assertRejected(response, "POST /builder/knowledge-plan");
  return "cross-owner-knowledge-plan-rejected";
}

async function scenarioCrossOwnerCompileAgentRejected(): Promise<string> {
  const draft = saveOwnedDraft("route_owner_compile_agent");
  const response = await route("POST", "/builder/compile-agent", {
    draft: hostileDraft(draft),
    draftId: draft.id,
    selectedTools: [],
  });
  await assertRejected(response, "POST /builder/compile-agent");
  return "cross-owner-compile-agent-rejected";
}

async function route(
  method: string,
  path: string,
  body?: unknown,
  requestIdentity = identity("tenant-b", "user-b"),
): Promise<Response> {
  const router = createBuilderRouter({
    config: builderConfig(),
    corsHeaders: {},
    workflows: createBuilderWorkflows(workflowDeps()),
  });
  const request = new Request(`http://127.0.0.1:8787${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await router.handle(
    request,
    new URL(request.url),
    { identity: requestIdentity },
  );
  assert(result.response, `${method} ${path} must produce a response`);
  return result.response;
}

async function assertRejected(response: Response, label: string): Promise<void> {
  const text = await response.text();
  assert(
    response.status === 400,
    `${label} must fail closed, got ${response.status}: ${text}`,
  );
  assert(
    text.includes("not owned by authenticated identity"),
    `${label} must reject cross-owner access, got ${text}`,
  );
}

function saveOwnedDraft(id: string): AgentBuildDraft {
  const owner = identity("tenant-a", "user-a");
  const base = agentDraft(id);
  const prompt = appendServerOwnedPromptPolicy("Base prompt.", base, []);
  const draft = mutateDraft(base)
    .selectTools([])
    .promptPlan({
      questions: [{ id: "q1", label: "Q1", required: true }],
      assumptions: [],
      promptPart1: "Base prompt.",
      doRules: [],
      dontRules: [],
      recommendedVoice: {
        provider: "gemini",
        voice: "Puck",
        tone: "clear",
        rationale: "test",
      },
    })
    .finalPrompt(prompt)
    .knowledgePlan({
      ...base.knowledgePlan!,
      documents: base.knowledgePlan!.documents.map((document) => ({
        ...document,
        text: "Owned knowledge document body.",
      })),
    })
    .compiled({ ...base.compiled!, prompt, selectedTools: [] })
    .metadata({ builderOwner: owner })
    .build();
  saveDraft(draft);
  return draft;
}

function hostileDraft(serverDraft: AgentBuildDraft): AgentBuildDraft {
  return mutateDraft(agentDraft(`${serverDraft.id}_hostile`))
    .metadata({ builderOwner: identity("tenant-b", "user-b") })
    .build();
}

function workflowDeps(): BuilderWorkflowDependencies {
  const planner: Pick<
    PromptPlannerPort,
    "composeFinalPrompt" | "createKnowledgePlan"
  > = {
    async composeFinalPrompt(_input: FinalPromptBuildRequest) {
      return "Safe generated prompt.";
    },
    async createKnowledgePlan(_input: KnowledgeBuildRequest) {
      return {
        strategy: "hybrid_kg",
        alternativeStrategies: [],
        documents: [],
        chunking: { method: "semantic", targetTokens: 420, overlapTokens: 72 },
        indexes: [],
        kg: { enabled: false, entityTypes: [], relationTypes: [] },
        reasons: ["test"],
        validationRequired: false,
      };
    },
  };
  return {
    availableSecretNames: [],
    availableToolHandlerRefs: [],
    planner,
    research: { isConfigured: () => false },
    promptProvider: "gemini",
    promptModel: "gemini-test",
    researchProvider: "gemini",
    researchModel: "gemini-test",
  } as unknown as BuilderWorkflowDependencies;
}

function builderConfig(): BuilderConfig {
  return {
    defaults: {},
    availability: {},
    toolRegistry: [],
    strategies: {},
    providers: { prompt: [], research: [], verification: [] },
  } as unknown as BuilderConfig;
}

function identity(tenantId: string, userId: string): AuthTicketIdentity {
  return { tenantId, userId, scopes: ["builder:access"] };
}
