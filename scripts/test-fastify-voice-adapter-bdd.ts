import {
  createFastifyVoiceAdapter,
  type FastifyLike,
  type FastifyRequestLike,
  type FastifyRouteHandler,
} from "../src/server/adapters/fastify/index.js";
import type {
  BrowserVoiceServiceConfig,
  BrowserVoiceSocket,
  BrowserVoiceUserContext,
} from "../src/server/browser/index.js";
import type {
  VoiceSessionConfig,
} from "../src/server/index.js";

const results = [
  await scenarioRegistersHealthAndWebSocketRoutes(),
  await scenarioNormalizesRoutePrefixes(),
  await scenarioCreatesVoiceServiceFromExplicitConfig(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioRegistersHealthAndWebSocketRoutes(): Promise<string> {
  const app = new RecordingFastify();
  const voiceService = new RecordingVoiceService();
  const adapter = createFastifyVoiceAdapter({
    routePrefix: "/tenant-a",
    voiceService,
  });

  await adapter(app);

  const health = app.route("/tenant-a/voice/health");
  const ws = app.route("/tenant-a/voice/ws");
  assert(Boolean(health), "adapter must register a health route");
  assert(Boolean(ws), "adapter must register a websocket route");
  assert(ws?.options.websocket === true, "websocket route must opt into websocket mode");

  const healthPayload = await health?.handler({}, request({}));
  assert(
    JSON.stringify(healthPayload).includes("\"activeSessions\":3"),
    "health route must expose active session count",
  );

  const socket = new RecordingSocket();
  await ws?.handler({ socket }, request({
    tenantId: "tenant-a",
    userId: "user-a",
    planId: "pro",
  }));

  assert(
    voiceService.calls.at(0)?.socket === socket,
    "websocket route must delegate the Fastify socket to BrowserVoiceService",
  );
  assert(
    voiceService.calls.at(0)?.user.tenantId === "tenant-a" &&
      voiceService.calls.at(0)?.user.userId === "user-a" &&
      voiceService.calls.at(0)?.user.planId === "pro",
    "websocket route must map query scope to BrowserVoiceUserContext",
  );

  return "registers-health-and-websocket-routes";
}

async function scenarioNormalizesRoutePrefixes(): Promise<string> {
  const app = new RecordingFastify();
  await createFastifyVoiceAdapter({
    routePrefix: "///sdk///",
    voiceService: new RecordingVoiceService(),
  })(app);

  assert(
    app.paths.join(",") === "/sdk/voice/health,/sdk/voice/ws",
    `route prefixes must be normalized, got ${app.paths.join(",")}`,
  );
  assert(
    !app.paths.some((path) => path.includes("starter") || path.includes("//")),
    "core Fastify adapter must not leak starter paths or duplicate slashes",
  );

  return "normalizes-route-prefixes";
}

async function scenarioCreatesVoiceServiceFromExplicitConfig(): Promise<string> {
  const app = new RecordingFastify();
  const adapter = createFastifyVoiceAdapter({
    routePrefix: "/voice-sdk",
    voice: voiceConfig(),
  });

  await adapter(app);
  const socket = new RecordingSocket();
  await app.route("/voice-sdk/voice/ws")?.handler(socket, request({
    tenantId: "tenant-config",
    userId: "user-config",
  }));

  assert(
    socket.handlers.has("message") &&
      socket.handlers.has("close") &&
      socket.handlers.has("error"),
    "adapter-created BrowserVoiceService must attach browser stream handlers",
  );

  return "creates-voice-service-from-explicit-config";
}

class RecordingFastify implements FastifyLike {
  readonly routes: Array<{
    handler: FastifyRouteHandler;
    options: { websocket?: boolean };
    path: string;
  }> = [];

  get(
    path: string,
    optionsOrHandler: { websocket?: boolean } | FastifyRouteHandler,
    maybeHandler?: FastifyRouteHandler,
  ): unknown {
    const handler = typeof optionsOrHandler === "function"
      ? optionsOrHandler
      : maybeHandler;
    if (!handler) throw new Error(`missing handler for ${path}`);
    this.routes.push({
      handler,
      options: typeof optionsOrHandler === "function" ? {} : optionsOrHandler,
      path,
    });
    return undefined;
  }

  get paths(): string[] {
    return this.routes.map((route) => route.path);
  }

  route(path: string) {
    return this.routes.find((route) => route.path === path);
  }
}

class RecordingVoiceService {
  readonly activeSessionCount = 3;
  readonly calls: Array<{
    socket: BrowserVoiceSocket;
    user: BrowserVoiceUserContext;
  }> = [];

  handleBrowserStream(
    socket: BrowserVoiceSocket,
    user: BrowserVoiceUserContext,
  ): void {
    this.calls.push({ socket, user });
  }
}

class RecordingSocket implements BrowserVoiceSocket {
  readonly readyState = 1;
  readonly handlers = new Map<string, (...args: unknown[]) => unknown>();

  close(_code?: number, _reason?: string): void {}

  send(_data: string | Buffer): void {}

  on(
    event: "message",
    handler: (data: unknown, isBinary?: boolean) => void | Promise<void>,
  ): this;
  on(event: "close", handler: () => void | Promise<void>): this;
  on(event: "error", handler: (error: unknown) => void | Promise<void>): this;
  on(
    event: "message" | "close" | "error",
    handler: (...args: never[]) => void | Promise<void>,
  ): this {
    const stored = handler as (...args: unknown[]) => unknown;
    this.handlers.set(event, stored);
    return this;
  }
}

function request(query: Record<string, string>): FastifyRequestLike {
  return { query };
}

function voiceConfig(): BrowserVoiceServiceConfig {
  return {
    createSession: async (sessionRequest) => {
      const config: VoiceSessionConfig = {
        channel: "voice",
        sessionId: sessionRequest.sessionId,
      };
      return {
        config,
        handleAudio(_chunk: Buffer): void {},
        async end(): Promise<void> {},
        interrupt(): void {},
        sessionId: sessionRequest.sessionId,
        async start(): Promise<void> {},
        state: "initializing",
      };
    },
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
