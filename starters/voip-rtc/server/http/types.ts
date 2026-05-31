import type { AuthTicketPort } from "@voiceagentsdk/core/sdk";
import type { ActiveAgentScope } from "@voiceagentsdk/core/sdk";
import type { BuilderRequestContext } from "../builder/types.js";
import type { RuntimeProviderConfig } from "../providers/catalog.js";
import type { StarterMode } from "../app/starter-mode.js";
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
  providerCatalog: RuntimeProviderConfig[];
  runtimePendingActions?: RuntimePendingActionApprovalService;
  voiceService: {
    readonly activeSessionCount: number;
  };
}
