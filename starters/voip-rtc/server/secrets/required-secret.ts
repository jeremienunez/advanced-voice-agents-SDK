import type {
  SecretResolveInput,
  SecretResolverPort,
} from "@voiceagentsdk/core/sdk";

export function resolveRequiredSecret(
  resolver: SecretResolverPort,
  input: SecretResolveInput,
): string {
  const value = resolver.resolveSecret(input);
  if (value) return value;
  throw new Error(`Missing secret: ${secretNames(input).join(", ")}`);
}

function secretNames(input: SecretResolveInput): string[] {
  return Array.from(new Set([input.ref.name, ...(input.aliases ?? [])]));
}
