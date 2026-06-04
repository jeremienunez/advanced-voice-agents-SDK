import {
  createMcpStreamableHttpToolHandler,
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

const handler = createMcpStreamableHttpToolHandler({
  tools: [tool],
  policy: new ToolExecutionPolicyEngine(),
  context: {
    sessionId: "mcp_http_session",
    tenantId: "local",
    userId: "demo",
    providerId: "mcp",
  },
  serverInfo: { name: "voiceagentsdk-http-test", version: "0.1.0-test" },
});

const results = [
  await scenarioInitializeNegotiatesLatestVersionFromBody(),
  await scenarioPostInitializeUsesJsonRpcAndTransportHeaders(),
  await scenarioPostToolCallRoutesThroughPolicy(),
  await scenarioNotificationReturnsAccepted(),
  await scenarioInvalidJsonRpcInputReturnsHttpError(),
  await scenarioUnsupportedVersionAndMissingAcceptFailClosed(),
  await scenarioGetStreamIsExplicitlyUnsupported(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioInitializeNegotiatesLatestVersionFromBody(): Promise<string> {
  const response = await handler(new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "init-latest",
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "latest-bdd", version: "1.0.0" },
      },
    }),
  }));
  const payload = await response.json() as {
    result?: { protocolVersion?: string };
  };

  assert(response.status === 200, "initial initialize must allow missing MCP-Protocol-Version header");
  assert(
    response.headers.get("mcp-protocol-version") === "2025-11-25",
    "initial initialize must negotiate the latest MCP version from params.protocolVersion",
  );
  assert(
    payload.result?.protocolVersion === "2025-11-25",
    "initialize result must return the negotiated latest MCP version",
  );

  return "initialize-negotiates-latest-version-from-body";
}

async function scenarioPostInitializeUsesJsonRpcAndTransportHeaders(): Promise<string> {
  const response = await handler(jsonRequest({
    jsonrpc: "2.0",
    id: "init-1",
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "bdd", version: "1.0.0" },
    },
  }));
  const payload = await response.json() as {
    result?: { protocolVersion?: string; serverInfo?: { name?: string } };
  };

  assert(response.status === 200, "initialize POST must return 200");
  assert(
    response.headers.get("content-type")?.includes("application/json"),
    "JSON-RPC response must be application/json",
  );
  assert(
    response.headers.get("mcp-protocol-version") === "2025-06-18",
    "response must advertise the negotiated MCP protocol version",
  );
  assert(
    payload.result?.protocolVersion === "2025-06-18",
    "initialize must return MCP protocol version",
  );
  assert(
    payload.result?.serverInfo?.name === "voiceagentsdk-http-test",
    "initialize must route through the JSON-RPC adapter",
  );

  return "post-initialize-uses-json-rpc-and-transport-headers";
}

async function scenarioPostToolCallRoutesThroughPolicy(): Promise<string> {
  const response = await handler(jsonRequest({
    jsonrpc: "2.0",
    id: "call-1",
    method: "tools/call",
    params: {
      name: "lookup_order",
      arguments: { orderId: "A-1" },
    },
  }));
  const payload = await response.json() as {
    result?: { content?: Array<{ type?: string; text?: string }>; isError?: boolean };
  };

  assert(response.status === 200, "tools/call POST must return 200");
  assert(calls.length === 1, "tools/call must execute through policy engine");
  assert(payload.result?.content?.[0]?.type === "text", "tools/call must return MCP text content");
  assert(payload.result?.content?.[0]?.text?.includes("shipped"), "tool result must be serialized");
  assert(payload.result?.isError !== true, "successful tool call must not be marked error");

  return "post-tool-call-routes-through-policy";
}

async function scenarioNotificationReturnsAccepted(): Promise<string> {
  const response = await handler(jsonRequest({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  }));
  const body = await response.text();

  assert(response.status === 202, "JSON-RPC notifications must return 202");
  assert(body === "", "notification response must not include a body");

  return "notification-returns-accepted";
}

async function scenarioInvalidJsonRpcInputReturnsHttpError(): Promise<string> {
  const nullId = await handler(jsonRequest({
    jsonrpc: "2.0",
    id: null,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "bdd", version: "1.0.0" },
    },
  }));
  const invalidNotification = await handler(jsonRequest({
    jsonrpc: "2.0",
    method: "tools/list",
  }));

  assert(nullId.status === 400, "Streamable HTTP must reject null JSON-RPC ids with HTTP 400");
  assert(
    invalidNotification.status === 400,
    "Streamable HTTP must reject unsupported notifications with HTTP 400",
  );

  return "invalid-json-rpc-input-returns-http-error";
}

async function scenarioUnsupportedVersionAndMissingAcceptFailClosed(): Promise<string> {
  const unsupportedVersion = await handler(jsonRequest(
    { jsonrpc: "2.0", id: "ping-1", method: "ping" },
    { protocolVersion: "2024-11-05" },
  ));
  const missingSseAccept = await handler(new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "MCP-Protocol-Version": "2025-06-18",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: "ping-2", method: "ping" }),
  }));
  const unsupportedContentType = await handler(new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      "content-type": "text/plain",
      accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: "ping-3", method: "ping" }),
  }));

  assert(unsupportedVersion.status === 400, "unsupported MCP protocol versions must fail closed");
  assert(missingSseAccept.status === 406, "POST must require application/json and text/event-stream Accept");
  assert(unsupportedContentType.status === 415, "POST must require application/json content type");

  return "unsupported-version-and-missing-accept-fail-closed";
}

async function scenarioGetStreamIsExplicitlyUnsupported(): Promise<string> {
  const response = await handler(new Request("http://localhost/mcp", {
    method: "GET",
    headers: {
      accept: "text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
    },
  }));

  assert(response.status === 405, "GET streams must be explicitly unsupported until SSE is implemented");
  assert(response.headers.get("allow") === "POST", "unsupported stream response must advertise allowed method");

  return "get-stream-is-explicitly-unsupported";
}

function jsonRequest(
  payload: Record<string, unknown>,
  options: { protocolVersion?: string } = {},
): Request {
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": options.protocolVersion ?? "2025-06-18",
    },
    body: JSON.stringify(payload),
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
