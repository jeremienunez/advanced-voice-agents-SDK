import type {
  CompiledAgentArtifact,
  CompiledVoiceAgentSdk,
  PromptCompilerPort,
  RuntimePromptCompileInput,
} from "@voiceagentsdk/core/sdk";
import { withAffectChannelPolicy } from "./affect-policy.js";
import { withRuntimeKnowledgePolicy } from "./knowledge-policy.js";

interface StarterPromptCompilerOptions {
  builderService: {
    getCompiledArtifact(agentId?: string): CompiledAgentArtifact | undefined;
  };
  sdk: Pick<CompiledVoiceAgentSdk, "promptFor">;
}

export function createStarterPromptCompiler(
  options: StarterPromptCompilerOptions,
): PromptCompilerPort {
  return {
    compilePrompt(input) {
      const compiled = options.builderService.getCompiledArtifact(input.agentId);
      const base = compiled?.prompt
        ? withRuntimeKnowledgePolicy(compiled.prompt, compiled)
        : options.sdk.promptFor({
            channel: input.channel,
            variables: promptVariables(input),
          });
      return withAffectChannelPolicy(base, input.toolNames);
    },
  };
}

function promptVariables(
  input: RuntimePromptCompileInput,
): Record<string, string | number | boolean | null | undefined> {
  return {
    ...input.tenant.promptVariables,
    providerId: input.providerId,
    tenantId: input.tenant.tenantId,
    planId: input.tenant.planId,
    userId: input.tenant.userId,
    toolNames: input.toolNames.join(","),
  };
}
