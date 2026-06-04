import { builderAgentBankPayload } from "./state/agent-bank-payload.js";
import { requireOwnedDraft } from "./state/draft-ownership.js";
import { builderSessionPayload } from "./state/session-payload.js";
import { json } from "./http.js";
import { routeOnboardingRequest } from "./onboarding/routes.js";
import type { BuilderConfig, BuilderRequestContext, BuilderRouteResult } from "./types.js";
import type { createBuilderWorkflows } from "./workflows.js";

type BuilderWorkflows = ReturnType<typeof createBuilderWorkflows>;

export function createBuilderRouter(options: {
  config: BuilderConfig;
  corsHeaders: Record<string, string> | ((request: Request) => Record<string, string>);
  workflows: BuilderWorkflows;
}) {
  const { config, workflows } = options;

  return {
    async handle(
      request: Request,
      url: URL,
      context: BuilderRequestContext = {},
    ): Promise<BuilderRouteResult> {
      const corsHeaders =
        typeof options.corsHeaders === "function"
          ? options.corsHeaders(request)
          : options.corsHeaders;
      try {
        if (url.pathname === "/builder/config" && request.method === "GET") {
          return { response: json(config, corsHeaders) };
        }

        if (url.pathname === "/builder/session" && request.method === "GET") {
          return { response: json(builderSessionPayload(context), corsHeaders) };
        }

        if (url.pathname === "/builder/agents" && request.method === "GET") {
          return { response: json(builderAgentBankPayload(context), corsHeaders) };
        }

        const documentRequest = parseDraftDocumentPath(url.pathname);
        if (documentRequest && request.method === "GET") {
          const draft = requireOwnedDraft(documentRequest.draftId, context);
          const document = findKnowledgeDocument(
            draft,
            documentRequest.documentId,
          );
          if (!document) throw new Error("Knowledge document not found");
          return { response: json({ document }, corsHeaders) };
        }

        if (
          url.pathname.startsWith("/builder/drafts/") &&
          request.method === "GET"
        ) {
          const draftId = decodeURIComponent(
            url.pathname.slice("/builder/drafts/".length),
          );
          if (!draftId) throw new Error("draftId is required");
          return {
            response: json({ draft: requireOwnedDraft(draftId, context) }, corsHeaders),
          };
        }

        const onboarding = await routeOnboardingRequest(request, url);
        if (onboarding) {
          return {
            response: json(onboarding.body, corsHeaders, {
              status: onboarding.status,
            }),
          };
        }

        const response = await routePostRequest(request, url, workflows, context);
        return {
          response: response ? json(response, corsHeaders) : null,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Builder request failed";
        return {
          response: json({ error: message }, corsHeaders, { status: 400 }),
        };
      }
    },
  };
}

async function routePostRequest(
  request: Request,
  url: URL,
  workflows: BuilderWorkflows,
  context: BuilderRequestContext,
): Promise<unknown | null> {
  if (request.method !== "POST") return null;

  if (url.pathname === "/builder/session") {
    const body = await request.json();
    await workflows.activateSession(body, context);
    return builderSessionPayload(context);
  }

  if (url.pathname === "/builder/prompt-plan") {
    return workflows.createPromptPlan(await request.json(), context);
  }

  if (url.pathname === "/builder/prompt-clarifications") {
    return workflows.savePromptClarifications(await request.json(), context);
  }

  if (url.pathname === "/builder/ingest-document") {
    return workflows.ingestDocument(request, context);
  }

  if (url.pathname === "/builder/run-research") {
    return workflows.runResearch(await request.json(), context);
  }

  if (url.pathname === "/builder/autonomous-knowledge") {
    return workflows.buildAutonomousKnowledge(await request.json(), context);
  }

  if (url.pathname === "/builder/knowledge-plan") {
    return workflows.createKnowledgePlan(await request.json(), context);
  }

  if (url.pathname === "/builder/database-plan") {
    return workflows.createDatabasePlan(await request.json(), context);
  }

  if (url.pathname === "/builder/apply-database") {
    return workflows.applyDatabase(await request.json(), context);
  }

  if (url.pathname === "/builder/compile-knowledge") {
    return workflows.compileKnowledge(await request.json(), context);
  }

  if (url.pathname === "/builder/compile-agent") {
    return workflows.compileAgent(await request.json(), context);
  }

  return null;
}

function parseDraftDocumentPath(
  pathname: string,
): { draftId: string; documentId: string } | null {
  const prefix = "/builder/drafts/";
  if (!pathname.startsWith(prefix)) return null;
  const suffix = pathname.slice(prefix.length);
  const marker = "/documents/";
  const markerIndex = suffix.indexOf(marker);
  if (markerIndex < 0) return null;
  const draftId = decodeURIComponent(suffix.slice(0, markerIndex));
  const documentId = decodeURIComponent(suffix.slice(markerIndex + marker.length));
  if (!draftId || !documentId) throw new Error("draftId and documentId are required");
  return { draftId, documentId };
}

function findKnowledgeDocument(
  draft: ReturnType<typeof requireOwnedDraft>,
  documentId: string,
) {
  return draft.knowledgePlan?.documents.find((document) => document.id === documentId) ??
    null;
}
