import { createBuilderServiceFromEnv } from "./builder.js";
import { VoyageEmbeddingPort } from "./builder/adapters/voyage-embeddings.js";
import {
  BunVoiceSocketAdapter,
  type WsData,
} from "./bun-voice-socket-adapter.js";
import { PostgresKnowledgeSearch } from "./adapters/postgres-knowledge-search.js";
import {
  createProviderCatalog,
  publicProviderConfig,
  resolveDefaultProviderId,
} from "./provider-catalog.js";
import { createStarterSdk } from "./starter-sdk.js";
import { createStarterVoiceService } from "./voice-service.js";

const port = Number(Bun.env.VOICE_SERVER_PORT ?? 8787);
const hostname = Bun.env.VOICE_SERVER_HOST ?? "127.0.0.1";
const publicHost = Bun.env.VOICE_PUBLIC_HOST ?? "localhost";
const authToken = Bun.env.VOICE_DEV_AUTH_TOKEN;
const isProduction = Bun.env.NODE_ENV === "production";
const browserSampleRate = 24000;
const providerCatalog = createProviderCatalog();
const defaultProviderId = resolveDefaultProviderId(providerCatalog);
const sdk = createStarterSdk(
  providerCatalog,
  defaultProviderId,
  browserSampleRate,
);

const allowedOrigins = resolveAllowedOrigins();

if ((isProduction || !isLoopbackHost(hostname)) && !authToken) {
  throw new Error(
    "VOICE_DEV_AUTH_TOKEN is required in production or when VOICE_SERVER_HOST is not loopback",
  );
}

const builderService = createBuilderServiceFromEnv({
  port,
  corsHeaders: corsHeadersFor,
});
const runtimeKnowledge = {
  embeddings: new VoyageEmbeddingPort({
    apiKey: Bun.env.VOYAGE_API_KEY,
    model: Bun.env.VOYAGE_EMBEDDING_MODEL ?? "voyage-4-large",
    dimensions: Number(Bun.env.VOYAGE_EMBEDDING_DIMENSIONS ?? 1024),
  }),
  embeddingAvailable: Boolean(Bun.env.VOYAGE_API_KEY),
  search: new PostgresKnowledgeSearch({
    databaseUrl: Bun.env.DATABASE_URL,
  }),
};
const voiceService = createStarterVoiceService({
  builderService,
  browserSampleRate,
  providerCatalog,
  runtimeKnowledge,
  sdk,
});

function json(data: unknown, request: Request): Response {
  return Response.json(data, { headers: corsHeadersFor(request) });
}

Bun.serve<WsData>({
  hostname,
  port,
  fetch(request, server) {
    const url = new URL(request.url);
    const originFailure = originGuard(request);
    if (originFailure) return originFailure;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeadersFor(request),
      });
    }

    if (url.pathname === "/health") {
      return json(
        {
          status: "ok",
          activeSessions: voiceService.activeSessionCount,
          timestamp: new Date().toISOString(),
        },
        request,
      );
    }

    if (url.pathname === "/config") {
      return json(
        {
          wsUrl: `ws://${publicHost}:${port}/voice/ws?tenantId=local&userId=demo`,
          defaultProviderId,
          provider: defaultProviderId,
          browserAudio: {
            encoding: "pcm16",
            sampleRate: browserSampleRate,
            channels: 1,
          },
          providers: providerCatalog.map(publicProviderConfig),
        },
        request,
      );
    }

    const accessFailure = accessGuard(request, url);
    if (accessFailure) return accessFailure;

    if (url.pathname.startsWith("/builder/")) {
      return builderService.handle(request, url).then(({ response }) => {
        return response ?? new Response("Not found", { status: 404 });
      });
    }

    if (url.pathname === "/voice/ws") {
      const upgraded = server.upgrade(request, {
        data: {
          user: {
            tenantId: url.searchParams.get("tenantId") ?? "local",
            userId: url.searchParams.get("userId") ?? "demo",
            planId: url.searchParams.get("planId") ?? "dev",
          },
        },
      });
      if (upgraded) return;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    return new Response("Not found", { status: 404 });
  },
  websocket: {
    open(socket) {
      const adapter = new BunVoiceSocketAdapter(socket);
      socket.data.adapter = adapter;
      voiceService.handleBrowserStream(adapter, socket.data.user);
    },
    message(socket, message) {
      socket.data.adapter?.emitMessage(message, typeof message !== "string");
    },
    close(socket) {
      socket.data.adapter?.emitClose();
    },
  },
});

console.log(`VOIP RTC starter server listening on http://${hostname}:${port}`);

function corsHeadersFor(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowOrigin =
    origin && allowedOrigins.has(origin) ? origin : firstAllowedOrigin();
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization,Content-Type,X-Voice-Agent-Token",
    Vary: "Origin",
  };
}

function originGuard(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin || allowedOrigins.has(origin)) return null;
  return new Response("Origin not allowed", {
    status: 403,
    headers: corsHeadersFor(request),
  });
}

function accessGuard(request: Request, url: URL): Response | null {
  if (!url.pathname.startsWith("/builder/") && url.pathname !== "/voice/ws") {
    return null;
  }
  if (isAuthorized(request, url)) return null;
  return new Response("Unauthorized", {
    status: 401,
    headers: corsHeadersFor(request),
  });
}

function isAuthorized(request: Request, url: URL): boolean {
  if (!authToken) return true;
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const headerToken = request.headers.get("x-voice-agent-token");
  const queryToken = url.searchParams.get("token");
  return [bearer, headerToken, queryToken].some((candidate) => {
    return candidate === authToken;
  });
}

function resolveAllowedOrigins(): Set<string> {
  const configured = Bun.env.VOICE_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origins = configured?.length
    ? configured
    : [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
      ];
  return new Set(origins);
}

function firstAllowedOrigin(): string {
  return allowedOrigins.values().next().value ?? "http://localhost:5173";
}

function isLoopbackHost(value: string): boolean {
  return value === "127.0.0.1" || value === "localhost" || value === "::1";
}
