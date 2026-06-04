import type { WsData } from "../adapters/bun/voice-socket-adapter.js";
import { publicProviderConfig } from "../providers/catalog.js";
import { resolveClientIp } from "./client-ip.js";
import { corsHeadersFor } from "./cors.js";
import { readBodyString, readDraftId } from "./draft-id.js";
import { accessGuard, originGuard } from "./guards.js";
import { requireOwnedDraft } from "../builder/state/draft-ownership.js";
import { activeAgentScopeFromContext } from "../builder/state/active-agent-assignment.js";
import { a2aAgentCardResponse, handleA2ARoute } from "./a2a-routes.js";
import { handleMcpRoute } from "./mcp-routes.js";
import type { BuilderRequestContext } from "../builder/types.js";
import type { StarterRouteContext } from "./types.js";

export function createFetchHandler(app: StarterRouteContext) {
  return async (request: Request, server: Bun.Server<WsData>) => {
    const url = new URL(request.url);
    const originFailure = originGuard(app.env, request);
    if (originFailure) return originFailure;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeadersFor(app.env, request),
      });
    }

    if (url.pathname === "/health") return healthResponse(app, request);
    if (url.pathname === "/config") return configResponse(app, request);
    if (url.pathname === "/.well-known/agent-card.json") {
      return a2aAgentCardResponse(app, request);
    }

    const access = await accessGuard(
      app.env,
      app.authTicketVerifier,
      request,
      url,
    );
    if (access.response) return access.response;

    if (url.pathname.startsWith("/builder/")) {
      return handleBuilderRoute(app, request, url, {
        identity: access.identity,
        clientIp: resolveClientIp(request, server),
      });
    }

    if (url.pathname === "/a2a" || url.pathname.startsWith("/a2a/")) {
      return handleA2ARoute(app, request, url, {
        identity: access.identity,
        clientIp: resolveClientIp(request, server),
      });
    }

    if (url.pathname === "/mcp") {
      return handleMcpRoute(app, request, url, {
        identity: access.identity,
        clientIp: resolveClientIp(request, server),
      });
    }

    if (url.pathname === "/voice/ws") {
      if (!access.identity) return new Response("Unauthorized", { status: 401 });
      const upgraded = server.upgrade(request, {
        data: {
          user: access.identity,
        },
      });
      if (upgraded) return;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    return new Response("Not found", { status: 404 });
  };
}

function healthResponse(
  app: StarterRouteContext,
  request: Request,
): Response {
  return json(
    {
      status: "ok",
      activeSessions: app.voiceService.activeSessionCount,
      timestamp: new Date().toISOString(),
    },
    app,
    request,
  );
}

function configResponse(
  app: StarterRouteContext,
  request: Request,
): Response {
  return json(
    {
      wsUrl: `ws://${app.env.publicHost}:${app.env.port}/voice/ws?tenantId=local&userId=demo`,
      defaultProviderId: app.defaultProviderId,
      provider: app.defaultProviderId,
      browserAudio: {
        encoding: "pcm16",
        sampleRate: app.env.browserSampleRate,
        channels: 1,
      },
      providers: app.providerCatalog.map(publicProviderConfig),
    },
    app,
    request,
  );
}

async function handleBuilderRoute(
  app: StarterRouteContext,
  request: Request,
  url: URL,
  context: BuilderRequestContext,
): Promise<Response> {
  const pendingRoute = pendingActionRoute(url, request.method);
  if (pendingRoute) {
    if (!app.runtimePendingActions) {
      return json({ error: "Pending action approval is not configured" }, app, request, {
        status: 404,
      });
    }
    if (pendingRoute.action === "approve") {
      const result = await app.runtimePendingActions.approve(pendingRoute.id, context);
      return json({ status: "executed", result }, app, request);
    }
    const pending = await app.runtimePendingActions.reject(pendingRoute.id, context);
    return json({ status: "rejected", pendingActionId: pending.id }, app, request);
  }

  if (url.pathname === "/builder/agents/rollback" && request.method === "POST") {
    const draftId = readDraftId(await request.json());
    if (!draftId) return json({ error: "draftId is required" }, app, request);
    requireOwnedDraft(draftId, context);
    return json(
      await app.learningService.rollback(draftId, activeAgentScopeFromContext(context)),
      app,
      request,
    );
  }
  if (url.pathname === "/builder/agents/approve-infra-evolution" && request.method === "POST") {
    const body = await request.json();
    const draftId = readDraftId(body);
    const pendingId = readBodyString(body, "pendingId");
    if (!draftId) return json({ error: "draftId is required" }, app, request);
    if (!pendingId) return json({ error: "pendingId is required" }, app, request);
    requireOwnedDraft(draftId, context);
    return json(
      await app.learningService.approveInfraEvolution(
        draftId,
        pendingId,
        activeAgentScopeFromContext(context),
      ),
      app,
      request,
    );
  }
  const { response } = await app.builderService.handle(request, url, context);
  return response ?? new Response("Not found", { status: 404 });
}

function json(
  data: unknown,
  app: StarterRouteContext,
  request: Request,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(corsHeadersFor(app.env, request));
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  return Response.json(data, {
    ...init,
    headers,
  });
}

function pendingActionRoute(
  url: URL,
  method: string,
): { id: string; action: "approve" | "reject" } | null {
  if (method !== "POST") return null;
  const prefix = "/builder/runtime/pending-actions/";
  if (!url.pathname.startsWith(prefix)) return null;
  const [id, action] = url.pathname.slice(prefix.length).split("/");
  if (!id || (action !== "approve" && action !== "reject")) return null;
  return { id: decodeURIComponent(id), action };
}
