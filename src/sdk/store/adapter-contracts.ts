import type { StoreDefinition, StoreEntityDefinition } from "../types/store.js";

export type StoreAdapterContractKind = "sql" | "document" | "vector";

export interface StoreFieldMapping {
  entity: string;
  field: string;
  target: string;
}

export interface StoreIndexMapping {
  entity: string;
  index: string;
  target: string;
}

export interface StorePaginationContract {
  mode: "cursor" | "offset";
  cursorField?: string;
}

export interface StoreSoftDeleteContract {
  entity: string;
  field: string;
  mode: "timestamp" | "boolean";
}

export interface StoreAdapterMigrationPlan {
  id: string;
  description: string;
}

export interface StoreAdapterContractInput {
  fields: StoreFieldMapping[];
  indexes?: StoreIndexMapping[];
  pagination?: StorePaginationContract;
  softDelete?: StoreSoftDeleteContract;
  migrations?: StoreAdapterMigrationPlan[];
}

export interface StoreAdapterContract extends StoreAdapterContractInput {
  kind: StoreAdapterContractKind;
  indexes: StoreIndexMapping[];
}

export function createSqlStoreAdapterContract(
  input: StoreAdapterContractInput,
): StoreAdapterContract {
  return createStoreAdapterContract("sql", input);
}

export function createDocumentStoreAdapterContract(
  input: StoreAdapterContractInput,
): StoreAdapterContract {
  return createStoreAdapterContract("document", input);
}

export function createVectorStoreAdapterContract(
  input: StoreAdapterContractInput,
): StoreAdapterContract {
  return createStoreAdapterContract("vector", input);
}

export function assertStoreAdapterContract(
  store: StoreDefinition,
  contract: StoreAdapterContract,
): void {
  for (const mapping of contract.fields) {
    requireField(store, mapping.entity, mapping.field, "field mapping");
  }
  for (const mapping of contract.indexes) {
    requireIndex(store, mapping.entity, mapping.index);
  }
  if (contract.softDelete) {
    const entity = requireEntity(store, contract.softDelete.entity);
    if (entity.policy.softDeleteField !== contract.softDelete.field) {
      throw new Error(
        `Store "${store.id}" soft delete field "${contract.softDelete.field}" ` +
          `does not match entity "${entity.id}" policy`,
      );
    }
  }
}

function createStoreAdapterContract(
  kind: StoreAdapterContractKind,
  input: StoreAdapterContractInput,
): StoreAdapterContract {
  assertMigrationPlans(input.migrations ?? []);
  return {
    kind,
    fields: input.fields.map((field) => ({ ...field })),
    indexes: (input.indexes ?? []).map((index) => ({ ...index })),
    pagination: input.pagination ? { ...input.pagination } : undefined,
    softDelete: input.softDelete ? { ...input.softDelete } : undefined,
    migrations: (input.migrations ?? []).map((migration) => ({ ...migration })),
  };
}

function assertMigrationPlans(migrations: StoreAdapterMigrationPlan[]): void {
  for (const migration of migrations) {
    if ("apply" in migration) {
      throw new Error("Migration execution must be explicit outside adapter contracts");
    }
  }
}

function requireEntity(
  store: StoreDefinition,
  entityId: string,
): StoreEntityDefinition {
  const entity = store.entities.find((item) => item.id === entityId);
  if (!entity) throw new Error(`Store "${store.id}" has no entity "${entityId}"`);
  return entity;
}

function requireField(
  store: StoreDefinition,
  entityId: string,
  fieldId: string,
  label: string,
): void {
  const entity = requireEntity(store, entityId);
  if (!entity.fields.some((field) => field.id === fieldId)) {
    throw new Error(
      `Store "${store.id}" ${label} references missing field "${fieldId}"`,
    );
  }
}

function requireIndex(
  store: StoreDefinition,
  entityId: string,
  indexId: string,
): void {
  const entity = requireEntity(store, entityId);
  if (!entity.indexes.some((index) => index.id === indexId)) {
    throw new Error(
      `Store "${store.id}" index mapping references missing index "${indexId}"`,
    );
  }
}
