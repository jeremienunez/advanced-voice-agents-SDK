import type {
  DatabaseCredentialResolverPort,
  RuntimeDatabaseCredentialRef,
} from "@voiceagentsdk/core/sdk";

export class EnvDatabaseCredentialResolver
  implements DatabaseCredentialResolverPort {
  constructor(private readonly env: Record<string, string | undefined>) {}

  resolveDatabaseUrl(ref: RuntimeDatabaseCredentialRef): string | undefined {
    const value = this.env[ref.envName]?.trim();
    return value || undefined;
  }
}
