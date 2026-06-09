import type { JsonSchema } from "../json.js";
import type { DatabaseResourceId } from "./ids.js";

export interface DatabaseTableDefinition {
  id: DatabaseResourceId;
  description?: string;
  fields?: JsonSchema;
  primaryKey?: string;
  indexes?: string[];
}

export interface DatabaseCollectionDefinition {
  id: DatabaseResourceId;
  description?: string;
  schema?: JsonSchema;
  indexes?: string[];
}

export interface DatabaseVectorIndexDefinition {
  id: DatabaseResourceId;
  dimensions: number;
  metric?: "cosine" | "dot" | "euclidean";
  metadataSchema?: JsonSchema;
}

export interface DatabaseDefinition {
  id: string;
  adapterRef?: string;
  displayName?: string;
  tables: DatabaseTableDefinition[];
  collections: DatabaseCollectionDefinition[];
  vectorIndexes: DatabaseVectorIndexDefinition[];
  kvNamespaces: DatabaseResourceId[];
}

export interface DomainDataAdapter {
  query<T = unknown>(resourceId: DatabaseResourceId, input: unknown): Promise<T>;
  command?<T = unknown>(
    resourceId: DatabaseResourceId,
    input: unknown,
  ): Promise<T>;
}
