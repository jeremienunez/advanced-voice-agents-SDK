import {
  createMcpJsonRpcToolAdapter,
  ToolExecutionPolicyEngine,
  type VoiceSessionTool,
} from "@voiceagentsdk/core/server";

const calls: Array<Record<string, unknown>> = [];
const tool: VoiceSessionTool = {
  type: "function",
  name: "lookup_order",
  description: "Look up an order.",
  parameters: {
    type: "object",
    properties: { orderId: { type: "string" } },
    required: ["orderId"],
  },
  policy: { sideEffect: "read", executionMode: "automatic" },
  async execute(args) {
    calls.push(args);
    return { status: "shipped" };
  },
};

const adapter = createMcpJsonRpcToolAdapter({
  tools: [tool],
  policy: new ToolExecutionPolicyEngine(),
  context: {
    sessionId: "mcp_rpc_session",
    tenantId: "local",
    userId: "demo",
    providerId: "mcp",
  },
  serverInfo: { name: "voiceagentsdk-test", version: "0.1.0-test" },
});

const results = [
  await scenarioInitializeDeclaresToolCapability(),
  await scenarioToolsListAndCallRouteThroughPolicy(),
  await scenarioUnknownToolReturnsJsonRpcError(),
  await scenarioNullRequestIdIsInvalid(),
  await scenarioToolRequestWithoutIdIsNotAcceptedAsNotification(),
  await scenarioInitializedNotificationHasNoResponse(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioInitializeDeclaresToolCapability(): Promise<string> {
  const response = await adapter.handle({
    jsonrpc: "2.0",
    id: "init-1",
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "bdd", version: "1.0.0" },
    },
  });
  const result = response?.result as Record<string, any> | undefined;

  assert(response?.id === "init-1", "initialize must preserve JSON-RPC id");
  assert(result?.protocolVersion === "2025-11-25", "initialize must return MCP protocol version");
  assert(result?.capabilities?.tools?.listChanged === false, "initialize must declare tool capability");
  assert(result?.serverInfo?.name === "voiceagentsdk-test", "initialize must return server info");

  return "initialize-declares-tool-capability";
}

async function scenarioToolsListAndCallRouteThroughPolicy(): Promise<string> {
  const list = await adapter.handle({
    jsonrpc: "2.0",
    id: "list-1",
    method: "tools/list",
  });
  const call = await adapter.handle({
    jsonrpc: "2.0",
    id: "call-1",
    method: "tools/call",
    params: {
      name: "lookup_order",
      arguments: { orderId: "A-1" },
    },
  });
  const listed = list?.result as { tools?: Array<Record<string, any>> } | undefined;
  const called = call?.result as { content?: Array<Record<string, any>>; isError?: boolean } | undefined;

  assert(listed?.tools?.[0]?.name === "lookup_order", "tools/list must expose tool descriptors");
  assert(calls.length === 1, "tools/call must execute through policy engine");
  assert(called?.content?.[0]?.type === "text", "tools/call must return MCP content");
  assert(called?.isError !== true, "successful tools/call must not be marked error");

  return "tools-list-and-call-route-through-policy";
}

async function scenarioUnknownToolReturnsJsonRpcError(): Promise<string> {
  const response = await adapter.handle({
    jsonrpc: "2.0",
    id: "missing-1",
    method: "tools/call",
    params: {
      name: "missing_tool",
      arguments: {},
    },
  });

  assert(response?.id === "missing-1", "unknown tool error must preserve id");
  assert(response?.error?.code === -32602, "unknown tool must be a JSON-RPC params error");
  assert(!response?.result, "unknown tool error must not include a result");

  return "unknown-tool-returns-json-rpc-error";
}

async function scenarioNullRequestIdIsInvalid(): Promise<string> {
  const response = await adapter.handle({
    jsonrpc: "2.0",
    id: null,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "bdd", version: "1.0.0" },
    },
  });

  assert(response?.id === null, "invalid null id response must use null response id");
  assert(response?.error?.code === -32600, "MCP requests must reject null ids");
  assert(!response?.result, "invalid request must not include a result");

  return "null-request-id-is-invalid";
}

async function scenarioToolRequestWithoutIdIsNotAcceptedAsNotification(): Promise<string> {
  const response = await adapter.handle({
    jsonrpc: "2.0",
    method: "tools/list",
  });

  assert(response?.id === null, "invalid notification response must use null response id");
  assert(response?.error?.code === -32600, "tool requests without id must not be accepted as notifications");
  assert(!response?.result, "invalid notification must not include a result");

  return "tool-request-without-id-is-not-accepted-as-notification";
}

async function scenarioInitializedNotificationHasNoResponse(): Promise<string> {
  const response = await adapter.handle({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });

  assert(response === null, "initialized notification must not produce a response");

  return "initialized-notification-has-no-response";
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
