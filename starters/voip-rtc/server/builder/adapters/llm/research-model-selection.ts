import type { LlmModelProfile } from "@voiceagentsdk/core/sdk";

export function defaultResearchModel(
  profiles: LlmModelProfile[],
  provider: string | undefined,
): string | undefined {
  return profiles.find((profile) => {
    return profile.roles.includes("builder.researcher") &&
      (!provider || profile.provider === provider);
  })?.model;
}
