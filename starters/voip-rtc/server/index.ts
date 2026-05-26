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
const browserSampleRate = 24000;
const providerCatalog = createProviderCatalog();
const defaultProviderId = resolveDefaultProviderId(providerCatalog);
const sdk = createStarterSdk(
  providerCatalog,
  defaultProviderId,
  browserSampleRate,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const builderService = createBuilderServiceFromEnv({ port, corsHeaders });
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

function json(data: unknown): Response {
  return Response.json(data, { headers: corsHeaders });
}

Bun.serve<WsData>({
  port,
  fetch(request, server) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/health") {
      return json({
        status: "ok",
        activeSessions: voiceService.activeSessionCount,
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname === "/config") {
      return json({
        wsUrl: `ws://localhost:${port}/voice/ws?tenantId=local&userId=demo`,
        defaultProviderId,
        provider: defaultProviderId,
        browserAudio: {
          encoding: "pcm16",
          sampleRate: browserSampleRate,
          channels: 1,
        },
        providers: providerCatalog.map(publicProviderConfig),
      });
    }

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

console.log(`VOIP RTC starter server listening on http://localhost:${port}`);
