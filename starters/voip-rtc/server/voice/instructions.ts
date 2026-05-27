import { withRuntimeKnowledgePolicy } from "../runtime/knowledge-policy.js";
import type { BuilderService, StarterSdk } from "./types.js";

export function instructionsForRequest(
  providerId: string,
  agentId: string | undefined,
  options: {
    builderService: BuilderService;
    sdk: StarterSdk;
  },
): string {
  const compiled = options.builderService.getCompiledArtifact(agentId);
  if (compiled?.prompt) {
    return withRuntimeKnowledgePolicy(compiled.prompt, compiled);
  }
  return options.sdk.promptFor({
    channel: "voice",
    variables: {
      tenantId: "local",
      providerId,
    },
  });
}
