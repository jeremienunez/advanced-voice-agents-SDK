import {
  createMcpToolRegistryAdapter,
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

const adapter = createMcpToolRegistryAdapter({
  tools: [tool],
  policy: new ToolExecutionPolicyEngine(),
  context: {
    sessionId: "mcp_session",
    tenantId: "local",
    userId: "demo",
    providerId: "mcp",
  },
});

const listed = adapter.listTools();
const result = await adapter.callTool({
  name: "lookup_order",
  arguments: { orderId: "A-1" },
});
const unknown = await adapter.callTool({
  name: "missing_tool",
  arguments: {},
});

assert(listed.tools[0]?.name === "lookup_order", "MCP adapter must list tools");
assert(calls.length === 1, "MCP adapter must execute through policy engine");
assert(result.content[0]?.type === "text", "MCP adapter must return text content");
assert(result.isError !== true, "MCP adapter must mark successful calls");
assert(unknown.isError === true, "MCP adapter must return tool errors as MCP errors");

console.log(JSON.stringify({
  status: "ok",
  results: ["mcp-tool-adapter-routes-through-policy"],
}, null, 2));

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
