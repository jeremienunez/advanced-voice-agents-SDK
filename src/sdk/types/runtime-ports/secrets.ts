import type { SecretRef } from "../core/index.js";

export interface SecretResolveInput {
  ref: SecretRef;
  aliases?: readonly string[];
  purpose?: string;
  metadata?: Record<string, unknown>;
}

export interface SecretResolverPort {
  resolveSecret(input: SecretResolveInput): string | undefined;
}
