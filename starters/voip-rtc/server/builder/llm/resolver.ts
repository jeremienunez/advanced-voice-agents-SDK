import type {
  LlmModelProfile,
  LlmModelResolverPort,
  LlmResolvedModel,
  LlmTask,
} from "@voiceagentsdk/core/sdk";

export class AdaptiveLlmModelResolver implements LlmModelResolverPort {
  constructor(private readonly profiles: LlmModelProfile[]) {}

  resolveModel(task: LlmTask): LlmResolvedModel {
    const requested = task.requestedModel?.provider
      ? this.matchRequested(task)
      : undefined;
    const profile = requested ?? this.matchBest(task);
    if (!profile) {
      throw new Error(`No configured model profile for ${task.role}`);
    }
    return {
      profile,
      providerOptions: {
        disableThinking: shouldDisableThinking(task, profile),
        maxOutputTokens: task.needs?.maxOutputTokens ?? null,
      },
    };
  }

  private matchRequested(task: LlmTask): LlmModelProfile | undefined {
    const provider = task.requestedModel?.provider;
    if (!provider) return undefined;
    const profile = this.profiles.find((item) => {
      return item.provider === provider &&
        item.roles.includes(task.role) &&
        item.configured &&
        supportsOutput(item, task);
    });
    if (!profile) return undefined;
    const model = task.requestedModel?.model?.trim();
    return model ? { ...profile, model, id: `${profile.provider}:${model}` } : profile;
  }

  private matchBest(task: LlmTask): LlmModelProfile | undefined {
    const candidates = this.profiles.filter((profile) => {
      return profile.configured &&
        profile.roles.includes(task.role) &&
        supportsOutput(profile, task);
    });
    return candidates.sort((left, right) => {
      return scoreProfile(right, task) - scoreProfile(left, task);
    })[0];
  }
}

function supportsOutput(profile: LlmModelProfile, task: LlmTask): boolean {
  if (!task.outputContract) return true;
  if (task.outputContract.kind === "json_schema") {
    return profile.capabilities.jsonSchema;
  }
  if (task.outputContract.kind === "json_object") {
    return profile.capabilities.structuredOutput;
  }
  return true;
}

function shouldDisableThinking(task: LlmTask, profile: LlmModelProfile): boolean {
  if (!profile.capabilities.reasoning) return false;
  return task.outputContract?.kind === "json_object" ||
    task.outputContract?.kind === "json_schema";
}

function scoreProfile(profile: LlmModelProfile, task: LlmTask): number {
  let score = 0;
  if (task.outputContract?.kind === "json_schema" && profile.capabilities.jsonSchema) {
    score += 10;
  }
  if (task.needs?.latency === profile.latencyClass) score += 2;
  if (task.role === "builder.verifier" && profile.provider === "kimi") score += 4;
  if (task.role === "builder.planner" && profile.provider === "deepseek") score += 3;
  if (task.role === "builder.planner" && profile.provider === "gemini") score += 2;
  if (profile.provider === "qwen") score += 1;
  return score;
}
