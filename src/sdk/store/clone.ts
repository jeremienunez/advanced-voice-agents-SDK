import type { StoreEntityDefinition } from "../types/store.js";

export function cloneStoreEntity(
  entity: StoreEntityDefinition,
): StoreEntityDefinition {
  return {
    ...entity,
    fields: entity.fields.map((field) => ({ ...field })),
    indexes: entity.indexes.map((index) => ({
      ...index,
      fields: [...index.fields],
    })),
    policy: {
      ...entity.policy,
      allowedOperations: [...entity.policy.allowedOperations],
      allowedFilterFields: [...entity.policy.allowedFilterFields],
      allowedSortFields: [...entity.policy.allowedSortFields],
      allowedCreateFields: [...entity.policy.allowedCreateFields],
      allowedUpdateFields: [...entity.policy.allowedUpdateFields],
    },
    timestamps: entity.timestamps ? { ...entity.timestamps } : undefined,
    search: entity.search
      ? {
          ...entity.search,
          fields: [...entity.search.fields],
          metadataFields: entity.search.metadataFields
            ? [...entity.search.metadataFields]
            : undefined,
        }
      : undefined,
  };
}
