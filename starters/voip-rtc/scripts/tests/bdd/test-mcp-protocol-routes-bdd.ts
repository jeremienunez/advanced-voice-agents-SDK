import {
  createA2AMailboxTaskRouter,
  createInMemoryAgentMailbox,
  ToolExecutionPolicyEngine,
  type McpJsonRpcResponse,
} from "@voiceagentsdk/core/server";
import type { AgentBuildDraft } from "@voiceagentsdk/core/sdk";
import { createDevAuthTicketVerifier } from "../../../server/auth/dev-ticket-verifier.js";
import { createFetchHandler } from "../../../server/http/routes.js";
import type { StarterRouteContext } from "../../../server/http/types.js";
import { createStarterMcpToolService } from "../../../server/mcp/tool-service.js";
import { builderService, serverEnv } from "../fixtures/solid-seams/fixtures.js";
import { assert } from "../shared/assertions.js";

const results = [
  await scenarioMcpCorsAllowsProtocolHeaders(),
  await scenarioMcpInitializeNegotiatesLatestWithoutProtocolHeader(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioMcpCorsAllowsProtocolHeaders(): Promise<string> {
  const response = await route("OPTIONS", "/mcp", undefined, { auth: false });
  const allowHeaders = response.headers
    .get("access-control-allow-headers")
    ?.toLowerCase() ?? "";

  assert(response.status === 204, `MCP preflight must return 204, got ${response.status}`);
  assert(
    allowHeaders.includes("mcp-protocol-version"),
    "MCP preflight must allow MCP-Protocol-Version",
  );
  assert(
    allowHeaders.includes("mcp-session-id"),
    "MCP preflight must allow MCP-Session-Id",
  );

  return "mcp-cors-allows-protocol-headers";
}

async function scenarioMcpInitializeNegotiatesLatestWithoutProtocolHeader(): Promise<string> {
  const response = await route("POST", "/mcp?agentId=draft_mcp_protocol", {
    jsonrpc: "2.0",
    id: "init-latest",
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "bdd", version: "1.0.0" },
    },
  }, { protocolVersion: null });
  const payload = await response.json() as McpJsonRpcResponse;
  const result = payload.result as { protocolVersion?: string } | undefined;

  assert(response.status === 200, `MCP initial initialize must return 200, got ${response.status}`);
  assert(
    response.headers.get("mcp-protocol-version") === "2025-11-25",
    "MCP route must negotiate latest version from initialize body when protocol header is absent",
  );
  assert(
    result?.protocolVersion === "2025-11-25",
    "MCP route initialize result must expose the negotiated latest version",
  );

  return "mcp-initialize-negotiates-latest-without-protocol-header";
}

async function route(
  method: string,
  path: string,
  body?: unknown,
  options: { auth?: boolean; protocolVersion?: string | null } = {},
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
  options: { auth?: boolean; protocolVersion?: string | null },
): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/json, text/event-stream",
  };
  if (options.protocolVersion !== null) {
    headers["MCP-Protocol-Version"] = options.protocolVersion ?? "2025-11-25";
  }
  if (body !== undefined) headers["content-type"] = "application/json";
  if (options.auth !== false) headers.authorization = "Bearer secret-token";
  return headers;
}

function app(): StarterRouteContext {
  const env = serverEnv();
  const a2aMailboxRouter = createA2AMailboxTaskRouter({
    mailbox: createInMemoryAgentMailbox(),
  });
  return {
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
}

function compiledDraft(): AgentBuildDraft {
  const createdAt = new Date(0).toISOString();
  return {
    id: "draft_mcp_protocol",
    status: "compiled",
    identity: {
      builderFirstName: "Ada",
      builderLastName: "Lovelace",
      publicAgentName: "MCP Protocol Agent",
      intent: "Expose MCP protocol behavior.",
      mustDo: [],
      mustNotDo: [],
      llmProvider: "gemini",
      llmModel: "gemini-test",
    },
    toolRegistry: [],
    selectedTools: [],
    promptParts: { final: "MCP protocol prompt" },
    compiled: {
      draftId: "draft_mcp_protocol",
      prompt: "MCP protocol prompt",
      toolRegistry: [],
      selectedTools: [],
      knowledge: {
        strategy: "hybrid",
        documentCount: 0,
        chunkCount: 0,
        status: "planned",
      },
      createdAt,
      sdkDefinition: {
        tenants: [],
        providers: [],
        mediaBridges: [],
        plans: [],
        prompts: [],
        tools: [],
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

function server(): Bun.Server<any> {
  return {
    requestIP: () => ({ address: "127.0.0.1", port: 12345 }),
    upgrade: () => false,
  } as unknown as Bun.Server<any>;
}
