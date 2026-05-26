import type { JsonSchema, JsonValue } from "./json.js";

export type StoreFieldKind =
  | "id"
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "json"
  | "binary"
  | "vector";

export type StoreOperation =
  | "get"
  | "list"
  | "search"
  | "create"
  | "update"
  | "delete"
  | "upsert";

export type StoreScopeMode =
  | "global"
  | "tenant"
  | "user"
  | "tenant-user"
  | "custom";

export interface StoreFieldDefinition {
  id: string;
  type: StoreFieldKind;
  description?: string;
  required?: boolean;
  nullable?: boolean;
  readonly?: boolean;
  unique?: boolean;
  indexed?: boolean;
  defaultValue?: JsonValue;
  schema?: JsonSchema;
  dimensions?: number;
}

export interface StoreIndexDefinition {
  id: string;
  fields: string[];
  unique?: boolean;
  description?: string;
}

export interface StoreSearchDefinition {
  fields: string[];
  vectorField?: string;
  metadataFields?: string[];
  maxResults?: number;
}

export interface StorePolicyDefinition {
  scope: StoreScopeMode;
  tenantField?: string;
  userField?: string;
  allowedOperations: StoreOperation[];
  allowedFilterFields: string[];
  allowedSortFields: string[];
  allowedCreateFields: string[];
  allowedUpdateFields: string[];
  maxPageSize: number;
  softDeleteField?: string;
}

export interface StoreEntityDefinition {
  id: string;
  displayName?: string;
  description?: string;
  primaryKey: string;
  fields: StoreFieldDefinition[];
  indexes: StoreIndexDefinition[];
  policy: StorePolicyDefinition;
  search?: StoreSearchDefinition;
  timestamps?: {
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string;
  };
}

export interface StoreDefinition {
  id: string;
  displayName?: string;
  description?: string;
  entities: StoreEntityDefinition[];
}
