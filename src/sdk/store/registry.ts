import type {
  DatabaseDefinition,
  DomainDataAdapter,
  StoreDefinition,
} from "../types.js";
import { createSafeRepository } from "./repository.js";
import type { SafeRepository, StoreAdapter } from "./types.js";

export interface DbAdapterRegistryOptions {
  databases?: Record<string, DomainDataAdapter>;
  stores?: Record<string, StoreAdapter>;
}

export interface DbAdapterRegistry {
  resolveDatabaseAdapter(ref: string): DomainDataAdapter | undefined;
  resolveStoreAdapter(ref: string): StoreAdapter | undefined;
}

export function createDbAdapterRegistry(
  options: DbAdapterRegistryOptions = {},
): DbAdapterRegistry {
  const databases = new Map(Object.entries(options.databases ?? {}));
  const stores = new Map(Object.entries(options.stores ?? {}));

  return {
    resolveDatabaseAdapter: (ref) => databases.get(ref),
    resolveStoreAdapter: (ref) => stores.get(ref),
  };
}

export function resolveDatabaseAdapterFromRegistry(
  definition: DatabaseDefinition,
  registry: DbAdapterRegistry,
): DomainDataAdapter {
  const ref = requireAdapterRef("Database", definition.id, definition.adapterRef);
  const adapter = registry.resolveDatabaseAdapter(ref);
  if (!adapter) {
    throw new Error(
      `Missing database adapter "${ref}" for database "${definition.id}"`,
    );
  }
  return adapter;
}

export function resolveStoreAdapterFromRegistry(
  definition: StoreDefinition,
  registry: DbAdapterRegistry,
): StoreAdapter {
  const ref = requireAdapterRef("Store", definition.id, definition.adapterRef);
  const adapter = registry.resolveStoreAdapter(ref);
  if (!adapter) {
    throw new Error(
      `Missing store adapter "${ref}" for store "${definition.id}"`,
    );
  }
  return adapter;
}

export function createSafeRepositoryFromRegistry<TRecord = Record<string, unknown>>(
  store: StoreDefinition,
  entityId: string,
  registry: DbAdapterRegistry,
): SafeRepository<TRecord> {
  const entity = store.entities.find((item) => item.id === entityId);
  if (!entity) {
    throw new Error(`Store "${store.id}" has no entity "${entityId}"`);
  }
  return createSafeRepository<TRecord>(
    entity,
    resolveStoreAdapterFromRegistry(store, registry),
  );
}

function requireAdapterRef(
  kind: "Database" | "Store",
  id: string,
  ref: string | undefined,
): string {
  if (!ref) throw new Error(`${kind} "${id}" has no adapterRef`);
  return ref;
}
