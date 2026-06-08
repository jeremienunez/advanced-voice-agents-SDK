import {
  createA2AMailboxTaskRouter,
  createInMemoryAgentMailbox,
  ToolExecutionPolicyEngine,
  type McpJsonRpcResponse,
} from "@voiceagentsdk/core/server";
import type { AgentBuildDraft, ToolManifest } from "@voiceagentsdk/core/sdk";
import { createDevAuthTicketVerifier } from "../../../server/auth/dev-ticket-verifier.js";
import { createFetchHandler } from "../../../server/http/routes.js";
import type { StarterRouteContext } from "../../../server/http/types.js";
import { createStarterMcpToolService } from "../../../server/mcp/tool-service.js";
import { builderService, serverEnv } from "../fixtures/solid-seams/fixtures.js";
import { assert } from "../shared/assertions.js";

let context: StarterRouteContext | undefined;

const results = [
  await scenarioMcpRouteRequiresAuth(),
  await scenarioMcpInitializeUsesStreamableHttpHandler(),
  await scenarioMcpToolsCallRuntimeAgentTool(),
  await scenarioMcpToolsCanUseA2AMailbox(),
  await scenarioMcpGetStreamIsNotSupported(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioMcpRouteRequiresAuth(): Promise<string> {
  const response = await route("POST", "/mcp", {
    jsonrpc: "2.0",
    id: "ping-unauthorized",
    method: "ping",
  }, { auth: false });
  assert(response.status === 401, `MCP route must require auth, got ${response.status}`);
  return "mcp-route-requires-auth";
}

async function scenarioMcpInitializeUsesStreamableHttpHandler(): Promise<string> {
  const response = await route("POST", "/mcp?agentId=draft_mcp", {
    jsonrpc: "2.0",
    id: "init-1",
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "bdd", version: "1.0.0" },
    },
  });
  const payload = await response.json() as McpJsonRpcResponse;
  const result = payload.result as {
    capabilities?: { tools?: { listChanged?: boolean } };
    serverInfo?: { name?: string };
  } | undefined;

  assert(response.status === 200, `MCP initialize must return 200, got ${response.status}`);
  assert(
    response.headers.get("mcp-protocol-version") === "2025-06-18",
    "MCP route must preserve transport protocol headers",
  );
  assert(
    result?.capabilities?.tools?.listChanged === false,
    "MCP initialize must expose tool capability",
  );
  assert(
    result?.serverInfo?.name === "voiceagentsdk-voip-rtc-starter",
    "MCP route must identify the starter server",
  );
  return "mcp-initialize-uses-streamable-http-handler";
}

async function scenarioMcpToolsCallRuntimeAgentTool(): Promise<string> {
  const listResponse = await route("POST", "/mcp?agentId=draft_mcp", {
    jsonrpc: "2.0",
    id: "list-1",
    method: "tools/list",
  });
  const callResponse = await route("POST", "/mcp?agentId=draft_mcp", {
    jsonrpc: "2.0",
    id: "call-1",
    method: "tools/call",
    params: {
      name: "create_summary",
      arguments: {
        summary: "Customer prefers morning calls.",
        keyFacts: ["morning"],
        nextActions: ["call back"],
      },
    },
  });
  const listed = await listResponse.json() as {
    result?: { tools?: Array<{ name?: string }> };
  };
  const called = await callResponse.json() as {
    result?: { content?: Array<{ text?: string }>; isError?: boolean };
  };

  assert(listResponse.status === 200, `MCP tools/list must return 200, got ${listResponse.status}`);
  assert(
    listed.result?.tools?.some((tool) => tool.name === "create_summary"),
    "MCP route must expose selected runtime agent tools",
  );
  assert(callResponse.status === 200, `MCP tools/call must return 200, got ${callResponse.status}`);
  assert(called.result?.isError !== true, "MCP tool call must not be marked error");
  assert(
    called.result?.content?.[0]?.text?.includes("created"),
    "MCP tool call must execute the runtime action handler",
  );
  return "mcp-tools-call-runtime-agent-tool";
}

async function scenarioMcpToolsCanUseA2AMailbox(): Promise<string> {
  const sent = await callMcpTool("a2a-send-1", "a2a_send_message", {
    targetAgentId: "critic",
    contextId: "ctx_mcp_bridge",
    taskId: "task_mcp_bridge",
    text: "Review the MCP to A2A bridge.",
  }) as { id?: string; status?: { state?: string } };
  const listed = await callMcpTool("a2a-list-1", "a2a_list_tasks", {
    targetAgentId: "critic",
    contextId: "ctx_mcp_bridge",
  }) as Array<{ id?: string }>;

  assert(sent.id === "task_mcp_bridge", "MCP route must let clients send A2A mailbox tasks");
  assert(sent.status?.state === "TASK_STATE_SUBMITTED", "MCP A2A send must create submitted tasks");
  assert(listed.some((task) => task.id === "task_mcp_bridge"), "MCP route must list A2A mailbox tasks");
  return "mcp-tools-can-use-a2a-mailbox";
}

async function scenarioMcpGetStreamIsNotSupported(): Promise<string> {
  const response = await route("GET", "/mcp?agentId=draft_mcp", undefined, {
    accept: "text/event-stream",
  });

  assert(response.status === 405, `MCP GET stream must return 405, got ${response.status}`);
  assert(response.headers.get("allow") === "POST", "MCP GET must advertise POST as allowed");
  return "mcp-get-stream-is-not-supported";
}

async function route(
  method: string,
  path: string,
  body?: unknown,
  options: { accept?: string; auth?: boolean } = {},
): Promise<Response> {
  const response = await createFetchHandler(app())(
    new Request(`http://127.0.0.1:8787${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: requestHeaders(body, options),
    }),
    server(),
  );
  assert(response, `${method} ${path} must return a response`);
  return response;
}

function requestHeaders(
  body: unknown,
  options: { accept?: string; auth?: boolean },
): Record<string, string> {
  const headers: Record<string, string> = {
    accept: options.accept ?? "application/json, text/event-stream",
    "MCP-Protocol-Version": "2025-06-18",
  };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (options.auth !== false) headers.authorization = "Bearer secret-token";
  return headers;
}

function app(): StarterRouteContext {
  if (context) return context;
  const env = serverEnv();
  const a2aMailboxRouter = createA2AMailboxTaskRouter({
    mailbox: createInMemoryAgentMailbox(),
  });
  context = {
    a2aMailboxRouter,
    authTicketVerifier: createDevAuthTicketVerifier(env),
    builderService: builderService(compiledDraft()),
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
    mcpToolService: createStarterMcpToolService({
      a2aMailboxRouter,
      builderService: builderService(compiledDraft()),
      toolPolicyEngine: new ToolExecutionPolicyEngine(),
    }),
    providerCatalog: [],
    voiceService: { activeSessionCount: 0 },
  };
  return context;
}

function compiledDraft(): AgentBuildDraft {
  const tool = createSummaryTool();
  const createdAt = new Date(0).toISOString();
  return {
    id: "draft_mcp",
    status: "compiled",
    identity: {
      builderFirstName: "Ada",
      builderLastName: "Lovelace",
      publicAgentName: "MCP Test Agent",
      intent: "Expose runtime tools over MCP.",
      mustDo: [],
      mustNotDo: [],
      llmProvider: "gemini",
      llmModel: "gemini-test",
    },
    toolRegistry: [],
    selectedTools: [tool.name],
    promptParts: { final: "MCP test prompt" },
    compiled: {
      draftId: "draft_mcp",
      prompt: "MCP test prompt",
      toolRegistry: [],
      selectedTools: [tool.name],
      knowledge: {
        strategy: "hybrid",
        documentCount: 0,
        chunkCount: 0,
        status: "planned",
      },
      createdAt: new Date(0).toISOString(),
      sdkDefinition: {
        tenants: [],
        providers: [],
        mediaBridges: [],
        plans: [],
        prompts: [],
        tools: [tool],
        databases: [],
        stores: [],
        onboarding: [],
        packs: [],
      },
    },
    createdAt,
    updatedAt: createdAt,
  };
}

function createSummaryTool(): ToolManifest {
  return {
    name: "create_summary",
    description: "Create a customer summary.",
    category: "test",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string" },
        keyFacts: { type: "array", items: { type: "string" } },
        nextActions: { type: "array", items: { type: "string" } },
      },
      required: ["summary"],
    },
    handlerRef: "summary.create",
    sideEffect: "none",
    executionMode: "automatic",
  };
}

async function callMcpTool(
  id: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const response = await route("POST", "/mcp?agentId=draft_mcp", {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  });
  const payload = await response.json() as {
    result?: { content?: Array<{ text?: string }>; isError?: boolean };
  };
  const text = payload.result?.content?.[0]?.text;

  assert(response.status === 200, `MCP ${name} call must return 200, got ${response.status}`);
  assert(payload.result?.isError !== true, `MCP ${name} call must not be marked error`);
  assert(typeof text === "string", `MCP ${name} call must return text content`);
  return JSON.parse(text);
}

function server(): Bun.Server<any> {
  return {
    requestIP: () => ({ address: "127.0.0.1", port: 12345 }),
    upgrade: () => false,
  } as unknown as Bun.Server<any>;
}
