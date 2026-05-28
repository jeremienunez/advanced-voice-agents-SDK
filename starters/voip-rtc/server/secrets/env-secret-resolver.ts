import type {
  SecretResolveInput,
  SecretResolverPort,
} from "@voiceagentsdk/core/sdk";

export function createEnvSecretResolver(
  env: Record<string, string | undefined> = Bun.env,
): SecretResolverPort {
  return {
    resolveSecret(input: SecretResolveInput): string | undefined {
      for (const name of secretNames(input)) {
        const value = env[name];
        if (value) return value;
      }
      return undefined;
    },
  };
}

function secretNames(input: SecretResolveInput): string[] {
  return Array.from(new Set([input.ref.name, ...(input.aliases ?? [])]));
}
