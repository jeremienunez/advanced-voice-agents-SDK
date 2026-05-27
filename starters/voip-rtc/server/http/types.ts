import type { AuthTicketPort } from "@voiceagentsdk/core/sdk";
import type { BuilderRequestContext } from "../builder/types.js";
import type { RuntimeProviderConfig } from "../providers/catalog.js";

export interface StarterServerEnv {
  allowedOrigins: Set<string>;
  authToken?: string;
  browserSampleRate: number;
  hostname: string;
  isProduction: boolean;
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
    rollback(draftId: string): Promise<unknown>;
  };
  providerCatalog: RuntimeProviderConfig[];
  voiceService: {
    readonly activeSessionCount: number;
  };
}
