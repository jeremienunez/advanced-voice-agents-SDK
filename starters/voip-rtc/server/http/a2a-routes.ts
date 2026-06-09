import {
  createA2AJsonRpcMailboxAdapter,
} from "@voiceagentsdk/core/server";
import {
  createA2AAgentCard,
  type JsonValue,
} from "@voiceagentsdk/core/sdk";
import type { BuilderRequestContext } from "../builder/types.js";
import { corsHeadersFor } from "./cors.js";
import { readBodyString } from "./draft-id.js";
import type { StarterRouteContext } from "./types.js";

export function a2aAgentCardResponse(
  app: StarterRouteContext,
  request: Request,
): Response {
  return json(
    createA2AAgentCard({
      name: "VoiceAgentSDK VOIP RTC Starter",
      description: "Local A2A-compatible mailbox endpoint for starter agents.",
      url: publicA2AUrl(app),
      version: "0.1.0-alpha.1",
      capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: true,
        extendedAgentCard: false,
      },
      skills: [{
        id: "mailbox-task",
        name: "Mailbox task delegation",
        description: "Send, claim, ack, list, and retrieve inter-agent mailbox tasks.",
        tags: ["a2a", "mailbox", "coordination"],
        inputModes: ["text/plain", "application/json"],
        outputModes: ["text/plain", "application/json"],
      }],
    }),
    app,
    request,
  );
}

function publicA2AUrl(app: StarterRouteContext): string {
  const publicHost = app.env.publicHost;
  const base = publicHost.startsWith("http://") || publicHost.startsWith("https://")
    ? publicHost
    : `http://${publicHost}${hasPort(publicHost) ? "" : `:${app.env.port}`}`;
  return new URL("/a2a", base).toString();
}

function hasPort(publicHost: string): boolean {
  const host = publicHost.startsWith("[")
    ? publicHost.slice(publicHost.indexOf("]") + 1)
    : publicHost;
  return /:\d+$/.test(host);
}

export async function handleA2ARoute(
  app: StarterRouteContext,
  request: Request,
  url: URL,
  context: BuilderRequestContext,
): Promise<Response> {
  if (!context.identity) return new Response("Unauthorized", { status: 401 });
  const router = app.a2aMailboxRouter;
  if (!router) {
    return json({ error: "A2A mailbox router is not configured" }, app, request, {
      status: 404,
    });
  }
  if (url.pathname === "/a2a" && request.method === "POST") {
    const adapter = createA2AJsonRpcMailboxAdapter({ router });
    return json(
      await adapter.handle(await request.json(), {
        tenantId: context.identity.tenantId,
        sourceAgentId: context.identity.userId,
      }),
      app,
      request,
    );
  }
  if (url.pathname === "/a2a/message:send" && request.method === "POST") {
    const body = await request.json();
    return json(
      await router.sendMessage({
        tenantId: context.identity.tenantId,
        sourceAgentId: readBodyString(body, "sourceAgentId") ||
          context.identity.userId || "anonymous",
        sourceUserId: context.identity.userId,
        targetAgentId: requireBodyString(body, "targetAgentId"),
        targetUserId: readBodyString(body, "targetUserId") || undefined,
        contextId: readBodyString(body, "contextId") || undefined,
        taskId: readBodyString(body, "taskId") || undefined,
        referenceTaskIds: readBodyStringArray(body, "referenceTaskIds"),
        subject: readBodyString(body, "subject") || undefined,
        message: readA2AMessage(body),
      }),
      app,
      request,
    );
  }
  if (url.pathname === "/a2a/mailbox:claim" && request.method === "POST") {
    const body = await request.json();
    return json(
      await router.claimTasks({
        tenantId: context.identity.tenantId,
        targetAgentId: requireBodyString(body, "targetAgentId"),
        workerId: readBodyString(body, "workerId") ||
          context.identity.userId || "anonymous",
        leaseMs: readPositiveInteger(asRecord(body).leaseMs),
        limit: readPositiveInteger(asRecord(body).limit),
      }),
      app,
      request,
    );
  }
  if (url.pathname === "/a2a/mailbox:ack" && request.method === "POST") {
    const body = await request.json();
    return json(
      await router.ackTask({
        tenantId: context.identity.tenantId,
        targetAgentId: readBodyString(body, "targetAgentId") || undefined,
        sourceAgentId: readBodyString(body, "sourceAgentId") || undefined,
        taskId: requireBodyString(body, "taskId"),
        status: readAckStatus(body),
        reason: readBodyString(body, "reason") || undefined,
      }),
      app,
      request,
    );
  }
  if (url.pathname === "/a2a/tasks" && request.method === "GET") {
    return json(
      await router.listTasks({
        tenantId: context.identity.tenantId,
        targetAgentId: url.searchParams.get("targetAgentId") ?? undefined,
        sourceAgentId: url.searchParams.get("sourceAgentId") ?? undefined,
        contextId: url.searchParams.get("contextId") ?? undefined,
        limit: readPositiveInteger(url.searchParams.get("limit")),
      }),
      app,
      request,
    );
  }
  const taskId = a2aTaskId(url);
  if (taskId && request.method === "GET") {
    const task = await router.getTask({
      tenantId: context.identity.tenantId,
      targetAgentId: url.searchParams.get("targetAgentId") ?? undefined,
      sourceAgentId: url.searchParams.get("sourceAgentId") ?? undefined,
      taskId,
    });
    return task
      ? json(task, app, request)
      : json({ error: `Unknown A2A task "${taskId}"` }, app, request, {
        status: 404,
      });
  }
  return new Response("Not found", { status: 404 });
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

function readA2AMessage(body: unknown) {
  const message = asRecord(asRecord(body).message);
  const role: "user" | "agent" = message.role === "agent" ? "agent" : "user";
  const parts = Array.isArray(message.parts)
    ? message.parts
      .map((part) => asRecord(part))
      .map((part) =>
        typeof part.text === "string"
          ? { kind: "text" as const, text: part.text }
          : { kind: "data" as const, data: jsonData(part.data) }
      )
    : [];
  if (parts.length === 0) throw new Error("message.parts is required");
  return { role, parts };
}

function readBodyStringArray(body: unknown, key: string): string[] | undefined {
  const value = asRecord(body)[key];
  if (!Array.isArray(value)) return undefined;
  const values = value.filter((item): item is string => typeof item === "string");
  return values.length ? values : undefined;
}

function requireBodyString(body: unknown, key: string): string {
  const value = readBodyString(body, key);
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function readPositiveInteger(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function readAckStatus(body: unknown): "completed" | "failed" | "canceled" {
  const status = readBodyString(body, "status");
  if (status === "completed" || status === "failed" || status === "canceled") {
    return status;
  }
  throw new Error("status must be completed, failed, or canceled");
}

function a2aTaskId(url: URL): string | null {
  const prefix = "/a2a/tasks/";
  if (!url.pathname.startsWith(prefix)) return null;
  const id = url.pathname.slice(prefix.length);
  return id ? decodeURIComponent(id) : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function jsonData(value: unknown): JsonValue {
  return isJsonValue(value) ? value : null;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!value || typeof value !== "object") return false;
  return Object.values(value).every(isJsonValue);
}
