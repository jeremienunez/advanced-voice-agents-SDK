import {
  createBrowserVoiceService,
  type BrowserVoiceServiceConfig,
  type BrowserVoiceSocket,
  type BrowserVoiceUserContext,
} from "../../browser/voice-service.js";

export interface FastifyVoiceAdapterOptions {
  routePrefix?: string;
  resolveUser?: (
    request: FastifyRequestLike,
  ) => BrowserVoiceUserContext | Promise<BrowserVoiceUserContext>;
  voice?: BrowserVoiceServiceConfig;
  voiceService?: FastifyVoiceService;
}

export interface FastifyVoiceService {
  readonly activeSessionCount?: number;
  handleBrowserStream(
    socket: BrowserVoiceSocket,
    user?: BrowserVoiceUserContext,
  ): void;
}

export interface FastifyLike {
  get(
    path: string,
    optionsOrHandler: FastifyRouteOptions | FastifyRouteHandler,
    handler?: FastifyRouteHandler,
  ): unknown;
}

export interface FastifyRouteOptions {
  websocket?: boolean;
}

export interface FastifyRequestLike {
  query?: Record<string, unknown> | URLSearchParams;
}

export type FastifyRouteHandler = (
  connectionOrRequest: unknown,
  request?: FastifyRequestLike,
) => unknown | Promise<unknown>;

interface FastifyWebSocketConnection {
  socket?: unknown;
}

export function createFastifyVoiceAdapter(options: FastifyVoiceAdapterOptions) {
  const voiceService = voiceServiceFor(options);
  const routes = voiceRoutes(options.routePrefix);

  return async function fastifyVoiceAdapter(app: FastifyLike): Promise<void> {
    app.get(routes.health, async () => ({
      activeSessions: voiceService.activeSessionCount ?? 0,
      status: "ok",
    }));
    app.get(routes.websocket, { websocket: true }, async (connection, request) => {
      const socket = socketFromConnection(connection);
      const user = await userContextFor(options, request);
      voiceService.handleBrowserStream(socket, user);
    });
  };
}

function voiceServiceFor(
  options: FastifyVoiceAdapterOptions,
): FastifyVoiceService {
  if (options.voiceService) return options.voiceService;
  if (options.voice) return createBrowserVoiceService(options.voice);
  throw new Error(
    "Fastify voice adapter requires voiceService or voice config",
  );
}

function voiceRoutes(routePrefix: string | undefined): {
  health: string;
  websocket: string;
} {
  const prefix = normalizeRoutePrefix(routePrefix);
  return {
    health: `${prefix}/voice/health`,
    websocket: `${prefix}/voice/ws`,
  };
}

function normalizeRoutePrefix(routePrefix: string | undefined): string {
  const clean = (routePrefix ?? "")
    .split("/")
    .filter(Boolean)
    .join("/");
  return clean ? `/${clean}` : "";
}

async function userContextFor(
  options: FastifyVoiceAdapterOptions,
  request: FastifyRequestLike | undefined,
): Promise<BrowserVoiceUserContext> {
  const safeRequest = request ?? {};
  if (options.resolveUser) return options.resolveUser(safeRequest);
  return {
    planId: queryString(safeRequest.query, "planId"),
    tenantId: queryString(safeRequest.query, "tenantId"),
    userId: queryString(safeRequest.query, "userId"),
  };
}

function socketFromConnection(connection: unknown): BrowserVoiceSocket {
  if (isBrowserVoiceSocket(connection)) return connection;
  const candidate = (connection as FastifyWebSocketConnection | null)?.socket;
  if (isBrowserVoiceSocket(candidate)) return candidate;
  throw new Error(
    "Fastify websocket connection does not expose a compatible browser voice socket",
  );
}

function isBrowserVoiceSocket(value: unknown): value is BrowserVoiceSocket {
  if (!value || typeof value !== "object") return false;
  const socket = value as Partial<BrowserVoiceSocket>;
  return typeof socket.send === "function" &&
    typeof socket.close === "function" &&
    typeof socket.on === "function" &&
    typeof socket.readyState === "number";
}

function queryString(
  query: FastifyRequestLike["query"],
  key: string,
): string | undefined {
  if (query instanceof URLSearchParams) return stringValue(query.get(key));
  return stringValue(query?.[key]);
}

function stringValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return stringValue(value[0]);
  if (typeof value === "string") return value || undefined;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}
