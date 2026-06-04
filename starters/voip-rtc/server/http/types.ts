import type { AuthTicketPort } from "@voiceagentsdk/core/sdk";
import type { ActiveAgentScope } from "@voiceagentsdk/core/sdk";
import type { createA2AMailboxTaskRouter } from "@voiceagentsdk/core/server";
import type { BuilderRequestContext } from "../builder/types.js";
import type { RuntimeProviderConfig } from "../providers/catalog.js";
import type { StarterMode } from "../app/starter-mode.js";
import type { StarterMcpToolService } from "../mcp/tool-service.js";
import type { RuntimePendingActionApprovalService } from "../voice/pending-action-approval.js";

export interface StarterServerEnv {
  allowedOrigins: Set<string>;
  authToken?: string;
  browserSampleRate: number;
  hostname: string;
  isProduction: boolean;
  mode: StarterMode;
  port: number;
  publicHost: string;
}

export interface StarterRouteContext {
  a2aMailboxRouter?: ReturnType<typeof createA2AMailboxTaskRouter>;
  builderService: {
    handle(
      request: Request,
      url: URL,
      context?: BuilderRequestContext,
    ): Promise<{ response?: Response | null }>;
  };
  defaultProviderId: string;
  env: StarterServerEnv;
  authTicketVerifier: AuthTicketPort;
  learningService: {
    approveInfraEvolution(
      draftId: string,
      pendingId: string,
      scope?: ActiveAgentScope,
    ): Promise<unknown>;
    rollback(draftId: string, scope?: ActiveAgentScope): Promise<unknown>;
  };
  mcpToolService?: StarterMcpToolService;
  providerCatalog: RuntimeProviderConfig[];
  runtimePendingActions?: RuntimePendingActionApprovalService;
  voiceService: {
    readonly activeSessionCount: number;
  };
}
