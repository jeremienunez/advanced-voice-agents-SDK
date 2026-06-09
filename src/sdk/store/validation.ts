import type { StoreEntityDefinition, StoreOperation } from "../types/store.js";
import { unique } from "./store-policy-values.js";

function fieldIds(entity: StoreEntityDefinition): Set<string> {
  return new Set(entity.fields.map((field) => field.id));
}

export function validateEntity(entity: StoreEntityDefinition): void {
  const fields = fieldIds(entity);
  const checkFields = (values: string[], label: string) => {
    for (const value of values) {
      if (!fields.has(value)) {
        throw new Error(
          `Store entity "${entity.id}" ${label} references missing field "${value}"`,
        );
      }
    }
  };

  unique(entity.fields.map((field) => field.id), `field in "${entity.id}"`);
  unique(entity.indexes.map((index) => index.id), `index in "${entity.id}"`);

  if (!fields.has(entity.primaryKey)) {
    throw new Error(
      `Store entity "${entity.id}" primary key "${entity.primaryKey}" is not a field`,
    );
  }

  for (const index of entity.indexes) {
    checkFields(index.fields, `index "${index.id}"`);
  }

  checkFields(entity.policy.allowedFilterFields, "filter policy");
  checkFields(entity.policy.allowedSortFields, "sort policy");
  checkFields(entity.policy.allowedCreateFields, "create policy");
  checkFields(entity.policy.allowedUpdateFields, "update policy");

  if (entity.policy.tenantField) checkFields([entity.policy.tenantField], "tenant scope");
  if (entity.policy.userField) checkFields([entity.policy.userField], "user scope");
  if (entity.policy.softDeleteField) {
    checkFields([entity.policy.softDeleteField], "soft delete policy");
  }
  if (entity.search) {
    checkFields(entity.search.fields, "search policy");
    if (entity.search.vectorField) {
      checkFields([entity.search.vectorField], "vector search policy");
    }
    checkFields(entity.search.metadataFields ?? [], "search metadata policy");
  }

  if (entity.policy.maxPageSize < 1) {
    throw new Error(
      `Store entity "${entity.id}" maxPageSize must be greater than zero`,
    );
  }
}

export function assertOperation(
  entity: StoreEntityDefinition,
  operation: StoreOperation,
): void {
  if (!entity.policy.allowedOperations.includes(operation)) {
    throw new Error(
      `Store entity "${entity.id}" does not allow "${operation}"`,
    );
  }
}
