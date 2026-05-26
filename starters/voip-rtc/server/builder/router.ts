import { builderAgentBankPayload, builderSessionPayload, requireDraft } from "./state.js";
import { json } from "./http.js";
import type { BuilderConfig, BuilderRouteResult } from "./types.js";
import type { createBuilderWorkflows } from "./workflows.js";

type BuilderWorkflows = ReturnType<typeof createBuilderWorkflows>;

export function createBuilderRouter(options: {
  config: BuilderConfig;
  corsHeaders: Record<string, string>;
  workflows: BuilderWorkflows;
}) {
  const { config, corsHeaders, workflows } = options;

  return {
    async handle(request: Request, url: URL): Promise<BuilderRouteResult> {
      try {
        if (url.pathname === "/builder/config" && request.method === "GET") {
          return { response: json(config, corsHeaders) };
        }

        if (url.pathname === "/builder/session" && request.method === "GET") {
          return { response: json(builderSessionPayload(), corsHeaders) };
        }

        if (url.pathname === "/builder/agents" && request.method === "GET") {
          return { response: json(builderAgentBankPayload(), corsHeaders) };
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
            response: json({ draft: requireDraft(draftId) }, corsHeaders),
          };
        }

        const response = await routePostRequest(request, url, workflows);
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
): Promise<unknown | null> {
  if (request.method !== "POST") return null;

  if (url.pathname === "/builder/session") {
    const body = await request.json();
    workflows.activateSession(body);
    return builderSessionPayload();
  }

  if (url.pathname === "/builder/prompt-plan") {
    return workflows.createPromptPlan(await request.json());
  }

  if (url.pathname === "/builder/prompt-clarifications") {
    return workflows.savePromptClarifications(await request.json());
  }

  if (url.pathname === "/builder/ingest-document") {
    return workflows.ingestDocument(request);
  }

  if (url.pathname === "/builder/run-research") {
    return workflows.runResearch(await request.json());
  }

  if (url.pathname === "/builder/autonomous-knowledge") {
    return workflows.buildAutonomousKnowledge(await request.json());
  }

  if (url.pathname === "/builder/knowledge-plan") {
    return workflows.createKnowledgePlan(await request.json());
  }

  if (url.pathname === "/builder/database-plan") {
    return workflows.createDatabasePlan(await request.json());
  }

  if (url.pathname === "/builder/apply-database") {
    return workflows.applyDatabase(await request.json());
  }

  if (url.pathname === "/builder/compile-knowledge") {
    return workflows.compileKnowledge(await request.json());
  }

  if (url.pathname === "/builder/compile-agent") {
    return workflows.compileAgent(await request.json());
  }

  return null;
}
