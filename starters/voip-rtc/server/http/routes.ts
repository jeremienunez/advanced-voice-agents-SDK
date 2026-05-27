import type { WsData } from "../adapters/bun/voice-socket-adapter.js";
import { publicProviderConfig } from "../providers/catalog.js";
import { corsHeadersFor } from "./cors.js";
import { readDraftId } from "./draft-id.js";
import { accessGuard, originGuard } from "./guards.js";
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

    const access = await accessGuard(
      app.env,
      app.authTicketVerifier,
      request,
      url,
    );
    if (access.response) return access.response;

    if (url.pathname.startsWith("/builder/")) {
      return handleBuilderRoute(app, request, url);
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
): Promise<Response> {
  if (url.pathname === "/builder/agents/rollback" && request.method === "POST") {
    const draftId = readDraftId(await request.json());
    if (!draftId) return json({ error: "draftId is required" }, app, request);
    return json(await app.learningService.rollback(draftId), app, request);
  }
  const { response } = await app.builderService.handle(request, url);
  return response ?? new Response("Not found", { status: 404 });
}

function json(
  data: unknown,
  app: StarterRouteContext,
  request: Request,
): Response {
  return Response.json(data, { headers: corsHeadersFor(app.env, request) });
}
