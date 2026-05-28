import type {
  DatabaseCredentialResolverPort,
  KnowledgeSearchScope,
} from "@voiceagentsdk/core/sdk";

export interface PostgresKnowledgeCredentialInput {
  scope: KnowledgeSearchScope;
  fallbackDatabaseUrl?: string;
  credentialResolver?: DatabaseCredentialResolverPort;
}

export async function resolvePostgresKnowledgeDatabaseUrl(
  input: PostgresKnowledgeCredentialInput,
): Promise<string | undefined> {
  const ref = input.scope.databaseCredentialRef;
  if (ref) return clean(await input.credentialResolver?.resolveDatabaseUrl(ref));
  return clean(input.fallbackDatabaseUrl);
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
