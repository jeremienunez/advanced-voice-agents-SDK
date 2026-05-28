import type { TenantResolutionResult } from "@voiceagentsdk/core/sdk";
import { withRuntimeKnowledgePolicy } from "../runtime/knowledge-policy.js";
import type { BuilderService, StarterSdk } from "./types.js";

export function instructionsForRequest(
  providerId: string,
  agentId: string | undefined,
  options: {
    builderService: BuilderService;
    sdk: StarterSdk;
  },
  tenant?: TenantResolutionResult,
): string {
  const compiled = options.builderService.getCompiledArtifact(agentId);
  if (compiled?.prompt) {
    return withRuntimeKnowledgePolicy(compiled.prompt, compiled);
  }
  return options.sdk.promptFor({
    channel: "voice",
    variables: {
      ...tenant?.promptVariables,
      providerId,
      tenantId: tenant?.tenantId ?? "local",
      planId: tenant?.planId,
      userId: tenant?.userId,
    },
  });
}
