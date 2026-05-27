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
    ): Promise<{ response?: Response | null }>;
  };
  defaultProviderId: string;
  env: StarterServerEnv;
  learningService: {
    rollback(draftId: string): Promise<unknown>;
  };
  providerCatalog: RuntimeProviderConfig[];
  voiceService: {
    readonly activeSessionCount: number;
  };
}
