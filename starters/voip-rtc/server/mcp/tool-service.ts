import {
  createA2AMailboxMcpTools,
  createMcpStreamableHttpToolHandler,
  type createA2AMailboxTaskRouter,
  type ToolExecutionPolicyEngine,
} from "@voiceagentsdk/core/server";
import type { BuilderRequestContext } from "../builder/types.js";
import { toolsForRequest } from "../voice/toolset.js";
import type { BuilderService, RuntimeKnowledge } from "../voice/types.js";

export interface StarterMcpToolServiceOptions {
  a2aMailboxRouter?: ReturnType<typeof createA2AMailboxTaskRouter>;
  builderService: BuilderService;
  runtimeKnowledge?: RuntimeKnowledge;
  toolPolicyEngine: ToolExecutionPolicyEngine;
}

export interface StarterMcpToolService {
  handle(
    request: Request,
    url: URL,
    context: BuilderRequestContext,
  ): Promise<Response>;
}

export function createStarterMcpToolService(
  options: StarterMcpToolServiceOptions,
): StarterMcpToolService {
  return {
    async handle(request, url, context) {
      const agentId = stringParam(url, "agentId");
      const sessionId = sessionIdFromRequest(request, context, agentId);
      const tools = [
        ...toolsForRequest(agentId, {
          builderService: options.builderService,
          runtimeKnowledge: options.runtimeKnowledge,
        }),
        ...a2aMailboxTools(options),
      ];
      const handler = createMcpStreamableHttpToolHandler({
        tools,
        policy: options.toolPolicyEngine,
        context: {
          sessionId,
          tenantId: context.identity?.tenantId,
          userId: context.identity?.userId,
          agentId,
          providerId: "mcp",
        },
        serverInfo: {
          name: "voiceagentsdk-voip-rtc-starter",
          version: "0.1.0-alpha.1",
        },
      });
      return handler(request);
    },
  };
}

function a2aMailboxTools(
  options: StarterMcpToolServiceOptions,
) {
  return options.a2aMailboxRouter
    ? createA2AMailboxMcpTools({ router: options.a2aMailboxRouter })
    : [];
}

function sessionIdFromRequest(
  request: Request,
  context: BuilderRequestContext,
  agentId: string | undefined,
): string {
  const mcpSessionId = visibleAscii(request.headers.get("Mcp-Session-Id"));
  if (mcpSessionId) return mcpSessionId;
  return [
    "mcp",
    context.identity?.tenantId ?? "anonymous",
    context.identity?.userId ?? "anonymous",
    agentId ?? "active",
  ].join(":");
}

function stringParam(url: URL, key: string): string | undefined {
  const value = url.searchParams.get(key)?.trim();
  return value ? value : undefined;
}

function visibleAscii(value: string | null): string | undefined {
  if (!value) return undefined;
  return /^[\x21-\x7e]+$/.test(value) ? value : undefined;
}
