import type {
  StoreEntityDefinition,
  StoreOperation,
  StoreScopeMode,
} from "../types/store.js";
import type {
  SafeRepository,
  StoreAdapter,
  StoreQuery,
  StoreRecordSelector,
  StoreRuntimeContext,
  StoreSearchQuery,
} from "./types.js";
import { assertOperation, validateEntity } from "./validation.js";

export function createSafeRepository<TRecord = Record<string, unknown>>(
  definition: StoreEntityDefinition,
  adapter: StoreAdapter,
): SafeRepository<TRecord> {
  validateEntity(definition);

  return {
    definition,
    get: (id, context) => {
      assertOperation(definition, "get");
      return adapter.get<TRecord>(
        definition,
        createSelector(definition, id, context),
        context,
      );
    },
    list: (query, context) => {
      assertOperation(definition, "list");
      return adapter.list<TRecord>(
        definition,
        createSafeQuery(definition, query, context),
        context,
      );
    },
    search: (query, context) => {
      assertOperation(definition, "search");
      if (!definition.search) {
        throw new Error(`Store entity "${definition.id}" has no search index`);
      }
      if (!adapter.search) {
        throw new Error("Store adapter does not implement search");
      }
      return adapter.search<TRecord>(
        definition,
        createSafeSearchQuery(definition, query, context),
        context,
      );
    },
    create: (data, context) => {
      assertOperation(definition, "create");
      return adapter.create<TRecord>(
        definition,
        createSafePayload(definition, data, "create", context),
        context,
      );
    },
    update: (id, data, context) => {
      assertOperation(definition, "update");
      return adapter.update<TRecord>(
        definition,
        createSelector(definition, id, context),
        createSafePayload(definition, data, "update", context),
        context,
      );
    },
    delete: (id, context) => {
      assertOperation(definition, "delete");
      return adapter.delete(
        definition,
        createSelector(definition, id, context),
        context,
      );
    },
    upsert: (data, context) => {
      assertOperation(definition, "upsert");
      if (!adapter.upsert) {
        throw new Error("Store adapter does not implement upsert");
      }
      return adapter.upsert<TRecord>(
        definition,
        createSafePayload(definition, data, "create", context),
        context,
      );
    },
  };
}

function createScope(
  entity: StoreEntityDefinition,
  context: StoreRuntimeContext,
): Record<string, unknown> {
  const scope: Record<string, unknown> = {};
  const mode: StoreScopeMode = entity.policy.scope;

  if ((mode === "tenant" || mode === "tenant-user") && entity.policy.tenantField) {
    if (!context.tenantId) {
      throw new Error(`Store entity "${entity.id}" requires tenantId`);
    }
    scope[entity.policy.tenantField] = context.tenantId;
  }

  if ((mode === "user" || mode === "tenant-user") && entity.policy.userField) {
    if (!context.userId) {
      throw new Error(`Store entity "${entity.id}" requires userId`);
    }
    scope[entity.policy.userField] = context.userId;
  }

  return scope;
}

function createSelector(
  entity: StoreEntityDefinition,
  id: string,
  context: StoreRuntimeContext,
): StoreRecordSelector {
  return {
    id,
    scope: createScope(entity, context),
  };
}

function createSafeQuery(
  entity: StoreEntityDefinition,
  query: StoreQuery,
  context: StoreRuntimeContext,
): StoreQuery {
  const filter = { ...(query.filter ?? {}) };
  const scope = createScope(entity, context);

  assertAllowedFields(entity, Object.keys(filter), entity.policy.allowedFilterFields, "filter");
  for (const sort of query.sort ?? []) {
    assertAllowedFields(entity, [sort.field], entity.policy.allowedSortFields, "sort");
  }

  const limit = query.limit ?? entity.policy.maxPageSize;
  if (limit > entity.policy.maxPageSize) {
    throw new Error(
      `Store entity "${entity.id}" limit ${limit} exceeds maxPageSize ${entity.policy.maxPageSize}`,
    );
  }

  return {
    ...query,
    filter: { ...filter, ...scope },
    limit,
  };
}

function createSafeSearchQuery(
  entity: StoreEntityDefinition,
  query: StoreSearchQuery,
  context: StoreRuntimeContext,
): StoreSearchQuery {
  return {
    ...query,
    ...createSafeQuery(entity, query, context),
  };
}

function createSafePayload(
  entity: StoreEntityDefinition,
  data: Record<string, unknown>,
  mode: "create" | "update",
  context: StoreRuntimeContext,
): Record<string, unknown> {
  const allowed =
    mode === "create"
      ? entity.policy.allowedCreateFields
      : entity.policy.allowedUpdateFields;
  const payload = { ...data };

  assertAllowedFields(entity, Object.keys(payload), allowed, mode);

  if (mode === "create") {
    for (const field of entity.fields) {
      if (
        field.required &&
        !field.readonly &&
        field.defaultValue === undefined &&
        allowed.includes(field.id) &&
        payload[field.id] === undefined
      ) {
        throw new Error(
          `Store entity "${entity.id}" create payload is missing "${field.id}"`,
        );
      }
    }
  }

  return { ...payload, ...createScope(entity, context) };
}

function assertAllowedFields(
  entity: StoreEntityDefinition,
  fields: string[],
  allowed: string[],
  label: StoreOperation | "filter" | "sort",
): void {
  for (const field of fields) {
    if (!allowed.includes(field)) {
      throw new Error(
        `Store entity "${entity.id}" does not allow ${label} field "${field}"`,
      );
    }
  }
}
