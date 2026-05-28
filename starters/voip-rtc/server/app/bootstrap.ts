import { createBuilderServiceFromEnv } from "../builder/index.js";
import { createDevAuthTicketVerifier } from "../auth/dev-ticket-verifier.js";
import { createStarterLearningServiceFromEnv } from "../learning/service.js";
import {
  createProviderCatalog,
  resolveDefaultProviderId,
} from "../providers/catalog.js";
import { createStarterProviderFactory } from "../providers/realtime-provider-factory.js";
import { createEnvSecretResolver } from "../secrets/index.js";
import { createStarterVoiceService } from "../voice/service.js";
import { createDevTenantResolver } from "../voice/dev-tenant-resolver.js";
import { corsHeadersFor } from "../http/cors.js";
import { loadStarterServerEnv } from "./env.js";
import { createRuntimeKnowledgeFromEnv } from "./runtime-knowledge.js";
import { createStarterSdk } from "./starter-sdk.js";
import { createStarterPromptCompiler } from "../runtime/prompt-compiler.js";

export function createStarterServerApp() {
  const env = loadStarterServerEnv();
  const providerCatalog = createProviderCatalog();
  const defaultProviderId = resolveDefaultProviderId(providerCatalog);
  const sdk = createStarterSdk(
    providerCatalog,
    defaultProviderId,
    env.browserSampleRate,
  );
  const secretResolver = createEnvSecretResolver();
  const builderService = createBuilderServiceFromEnv({
    port: env.port,
    corsHeaders: (request) => corsHeadersFor(env, request),
  });
  const learningService = createStarterLearningServiceFromEnv();
  const voiceService = createStarterVoiceService({
    builderService,
    browserSampleRate: env.browserSampleRate,
    learning: learningService,
    providerCatalog,
    providerFactory: createStarterProviderFactory({
      providerCatalog,
      secretResolver,
    }),
    promptCompiler: createStarterPromptCompiler({ builderService, sdk }),
    runtimeKnowledge: createRuntimeKnowledgeFromEnv({ secretResolver }),
    secretResolver,
    tenantResolver: createDevTenantResolver(sdk),
    sdk,
  });

  return {
    authTicketVerifier: createDevAuthTicketVerifier(env),
    builderService,
    defaultProviderId,
    env,
    learningService,
    providerCatalog,
    sdk,
    voiceService,
  };
}

export type StarterServerApp = ReturnType<typeof createStarterServerApp>;
