import {
  createA2AMailboxTaskRouter,
  createInMemoryAgentMailbox,
  type A2ATask,
} from "@voiceagentsdk/core/server";
import { createDevAuthTicketVerifier } from "../../../server/auth/dev-ticket-verifier.js";
import { a2aAgentCardResponse } from "../../../server/http/a2a-routes.js";
import { createFetchHandler } from "../../../server/http/routes.js";
import type { StarterRouteContext } from "../../../server/http/types.js";
import { assert } from "../shared/assertions.js";
import { serverEnv } from "../fixtures/solid-seams/fixtures.js";

let context: StarterRouteContext | undefined;

const results = [
  await scenarioAgentCardIsDiscoverable(),
  await scenarioAgentCardUrlAcceptsPublicOriginVariants(),
  await scenarioA2AMessageSendCreatesMailboxTask(),
  await scenarioA2AListAndGetTasksExposeInbox(),
  await scenarioA2AClaimAndAckTasksCoordinateWorkers(),
  await scenarioA2AJsonRpcPostUsesAgentCardUrl(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioAgentCardIsDiscoverable(): Promise<string> {
  const response = await route("GET", "/.well-known/agent-card.json");
  const body = await response.json() as Record<string, any>;

  assert(response.status === 200, `agent card must be public, got ${response.status}`);
  assert(body.protocolVersion === "1.0", "agent card must declare A2A v1");
  assert(body.url === "http://127.0.0.1:8787/a2a", "agent card must expose a canonical A2A endpoint URL");
  assert(body.supportedInterfaces?.[0]?.protocolBinding === "JSONRPC", "agent card must advertise JSON-RPC binding");
  assert(body.supportedInterfaces?.[0]?.url === body.url, "agent card supported interface must match canonical URL");
  assert(body.capabilities?.streaming === false, "starter card must declare streaming capability");
  assert(body.skills?.[0]?.id === "mailbox-task", "agent card must advertise mailbox task skill");

  return "agent-card-is-discoverable";
}

async function scenarioAgentCardUrlAcceptsPublicOriginVariants(): Promise<string> {
  const fromUrl = await agentCardForPublicHost("https://agents.example.test", 443);
  const fromHostPort = await agentCardForPublicHost("127.0.0.1:9876", 8787);

  assert(fromUrl.url === "https://agents.example.test/a2a", "agent card must preserve configured HTTPS origins");
  assert(fromHostPort.url === "http://127.0.0.1:9876/a2a", "agent card must not duplicate host ports");

  return "agent-card-url-accepts-public-origin-variants";
}

async function scenarioA2AMessageSendCreatesMailboxTask(): Promise<string> {
  const response = await route("POST", "/a2a/message:send", {
    targetAgentId: "planner",
    sourceAgentId: "researcher",
    contextId: "ctx_wine_trip",
    taskId: "task_itinerary",
    referenceTaskIds: ["task_sources"],
    message: {
      role: "user",
      parts: [{ kind: "text", text: "Prepare two itineraries." }],
    },
  });
  const task = await response.json() as A2ATask;

  assert(response.status === 200, `message send must return 200, got ${response.status}`);
  assert(!hasOwn(task, "kind"), "message send must return a current A2A task object");
  assert(task.id === "task_itinerary", "message send must preserve task id");
  assert(task.contextId === "ctx_wine_trip", "message send must preserve context id");
  assert(task.status.state === "TASK_STATE_SUBMITTED", "message send must create submitted task");

  return "a2a-message-send-creates-mailbox-task";
}

async function scenarioA2AListAndGetTasksExposeInbox(): Promise<string> {
  await route("POST", "/a2a/message:send", {
    targetAgentId: "researcher",
    sourceAgentId: "planner",
    contextId: "ctx_wine_trip",
    taskId: "task_research",
    message: {
      role: "user",
      parts: [{ kind: "text", text: "Find source documents." }],
    },
  });

  const listResponse = await route(
    "GET",
    "/a2a/tasks?targetAgentId=researcher&contextId=ctx_wine_trip",
  );
  const listed = await listResponse.json() as A2ATask[];
  const getResponse = await route(
    "GET",
    "/a2a/tasks/task_research?targetAgentId=researcher",
  );
  const task = await getResponse.json() as A2ATask;

  assert(listResponse.status === 200, `list tasks must return 200, got ${listResponse.status}`);
  assert(listed.length === 1, "list tasks must filter target inbox");
  assert(listed[0]?.id === "task_research", "list tasks must expose task id");
  assert(getResponse.status === 200, `get task must return 200, got ${getResponse.status}`);
  assert(task.history?.[0]?.role === "ROLE_USER", "get task must expose current A2A message objects");
  assert(
    (task.history?.[0]?.parts[0] as Record<string, any> | undefined)?.text ===
      "Find source documents.",
    "get task must expose message history",
  );

  return "a2a-list-and-get-tasks-expose-inbox";
}

async function scenarioA2AClaimAndAckTasksCoordinateWorkers(): Promise<string> {
  await route("POST", "/a2a/message:send", {
    targetAgentId: "critic",
    sourceAgentId: "planner",
    contextId: "ctx_wine_trip",
    taskId: "task_review",
    message: {
      role: "user",
      parts: [{ kind: "text", text: "Review the final plan." }],
    },
  });

  const claimResponse = await route("POST", "/a2a/mailbox:claim", {
    targetAgentId: "critic",
    workerId: "critic-worker-1",
    leaseMs: 30_000,
    limit: 1,
  });
  const claimed = await claimResponse.json() as A2ATask[];
  const ackResponse = await route("POST", "/a2a/mailbox:ack", {
    targetAgentId: "critic",
    taskId: "task_review",
    status: "completed",
  });
  const completed = await ackResponse.json() as A2ATask;

  assert(claimResponse.status === 200, `claim must return 200, got ${claimResponse.status}`);
  assert(claimed.length === 1, "claim must lease one queued recipient task");
  assert(claimed[0]?.status.state === "TASK_STATE_WORKING", "claimed task must be working");
  assert(ackResponse.status === 200, `ack must return 200, got ${ackResponse.status}`);
  assert(completed.status.state === "TASK_STATE_COMPLETED", "ack must complete the task");

  return "a2a-claim-and-ack-tasks-coordinate-workers";
}

async function scenarioA2AJsonRpcPostUsesAgentCardUrl(): Promise<string> {
  const sendResponse = await route("POST", "/a2a", {
    jsonrpc: "2.0",
    id: "rpc-send",
    method: "message/send",
    params: {
      targetAgentId: "reviewer",
      sourceAgentId: "planner",
      message: {
        messageId: "msg-rpc",
        role: "user",
        taskId: "task_rpc",
        contextId: "ctx_rpc",
        parts: [{ kind: "text", text: "Review JSON-RPC compatibility." }],
      },
    },
  });
  const sent = await sendResponse.json() as { result?: { task?: A2ATask } };
  const getResponse = await route("POST", "/a2a", {
    jsonrpc: "2.0",
    id: "rpc-get",
    method: "GetTask",
    params: { id: "task_rpc", targetAgentId: "reviewer" },
  });
  const found = await getResponse.json() as { result?: A2ATask };

  assert(sendResponse.status === 200, `JSON-RPC send must return 200, got ${sendResponse.status}`);
  assert(sent.result?.task?.id === "task_rpc", "JSON-RPC send must create task");
  assert(getResponse.status === 200, `JSON-RPC get must return 200, got ${getResponse.status}`);
  assert(found.result?.id === "task_rpc", "JSON-RPC GetTask alias must retrieve task");

  return "a2a-json-rpc-post-uses-agent-card-url";
}

async function route(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const response = await createFetchHandler(app())(
    new Request(`http://127.0.0.1:8787${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: requestHeaders(path, body),
    }),
    server(),
  );
  assert(response, `${method} ${path} must return a response`);
  return response;
}

function requestHeaders(
  path: string,
  body: unknown,
): Record<string, string> | undefined {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (path === "/a2a" || path.startsWith("/a2a/")) {
    headers.authorization = "Bearer secret-token";
  }
  return Object.keys(headers).length ? headers : undefined;
}

function app(): StarterRouteContext {
  if (context) return context;
  const env = serverEnv();
  const mailbox = createInMemoryAgentMailbox({
    idFactory: idSequence("mail"),
    now: clock([
      "2026-06-04T09:00:00.000Z",
      "2026-06-04T09:00:01.000Z",
      "2026-06-04T09:00:02.000Z",
      "2026-06-04T09:00:03.000Z",
      "2026-06-04T09:00:04.000Z",
      "2026-06-04T09:00:05.000Z",
    ]),
  });
  context = {
    a2aMailboxRouter: createA2AMailboxTaskRouter({ mailbox }),
    authTicketVerifier: createDevAuthTicketVerifier(env),
    builderService: {
      async handle() {
        return { response: new Response("not used", { status: 404 }) };
      },
    },
    defaultProviderId: "gemini",
    env,
    learningService: {
      async approveInfraEvolution() {
        return {};
      },
      async rollback() {
        return {};
      },
    },
    providerCatalog: [],
    voiceService: { activeSessionCount: 0 },
  };
  return context;
}

async function agentCardForPublicHost(
  publicHost: string,
  port: number,
): Promise<Record<string, any>> {
  return await a2aAgentCardResponse(
    { ...app(), env: { ...app().env, publicHost, port } },
    new Request("http://127.0.0.1:8787/.well-known/agent-card.json"),
  ).json() as Record<string, any>;
}

function server(): Bun.Server<any> {
  return {
    requestIP: () => ({ address: "127.0.0.1", port: 12345 }),
    upgrade: () => false,
  } as unknown as Bun.Server<any>;
}

function idSequence(prefix: string): () => string {
  let current = 0;
  return () => `${prefix}_${++current}`;
}

function clock(values: string[]): () => Date {
  let index = 0;
  return () => new Date(values[Math.min(index++, values.length - 1)]!);
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
