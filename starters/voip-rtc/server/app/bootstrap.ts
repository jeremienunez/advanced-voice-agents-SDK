import { createBuilderServiceFromEnv } from "../builder/index.js";
import { createStarterLearningServiceFromEnv } from "../learning/service.js";
import {
  createProviderCatalog,
  resolveDefaultProviderId,
} from "../providers/catalog.js";
import { createStarterVoiceService } from "../voice/service.js";
import { corsHeadersFor } from "../http/cors.js";
import { loadStarterServerEnv } from "./env.js";
import { createRuntimeKnowledgeFromEnv } from "./runtime-knowledge.js";
import { createStarterSdk } from "./starter-sdk.js";

export function createStarterServerApp() {
  const env = loadStarterServerEnv();
  const providerCatalog = createProviderCatalog();
  const defaultProviderId = resolveDefaultProviderId(providerCatalog);
  const sdk = createStarterSdk(
    providerCatalog,
    defaultProviderId,
    env.browserSampleRate,
  );
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
    runtimeKnowledge: createRuntimeKnowledgeFromEnv(),
    sdk,
  });

  return {
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
