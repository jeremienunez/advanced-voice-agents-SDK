import {
  createDatabaseBuilder,
  createDbAdapterRegistry,
  createSafeRepositoryFromRegistry,
  createStoreBuilder,
  resolveDatabaseAdapterFromRegistry,
  type DomainDataAdapter,
  type StoreAdapter,
  type StoreEntityDefinition,
  type StoreQuery,
  type StoreRecordSelector,
  type StoreRuntimeContext,
} from "@voiceagentsdk/core/sdk";
import { assert, assertThrows } from "./shared/assertions.js";

const results = [
  await scenarioDefinitionsCarryAdapterRefsOnly(),
  await scenarioRegistryResolvesRuntimeAdapters(),
  scenarioMissingAdapterFailsClosed(),
  await scenarioSafeRepositoryGuardsSurviveRegistryResolution(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioDefinitionsCarryAdapterRefsOnly(): Promise<string> {
  const database = createDatabaseBuilder("crm-db")
    .adapterRef("postgres.crm")
    .table({ id: "contacts", primaryKey: "id" })
    .build();
  const store = createContactsStore("postgres.crm").build();
  const serialized = JSON.stringify({ database, store });

  assert(serialized.includes('"adapterRef":"postgres.crm"'), "definitions must carry adapter refs");
  assert(!serialized.includes("query"), "database adapter functions must not serialize");
  assert(!serialized.includes("function"), "store adapter functions must not serialize");

  return "definitions-carry-adapter-refs-only";
}

async function scenarioRegistryResolvesRuntimeAdapters(): Promise<string> {
  const databaseAdapter: DomainDataAdapter = {
    query: async <T = unknown>(_resourceId: string, input: unknown) => {
      return { input, source: "database-adapter" } as T;
    },
  };
  const storeAdapter = new RecordingStoreAdapter();
  const registry = createDbAdapterRegistry({
    databases: { "postgres.crm": databaseAdapter },
    stores: { "postgres.crm": storeAdapter },
  });
  const database = createDatabaseBuilder("crm-db")
    .adapterRef("postgres.crm")
    .table({ id: "contacts", primaryKey: "id" })
    .build();
  const repository = createSafeRepositoryFromRegistry<Record<string, unknown>>(
    createContactsStore("postgres.crm").build(),
    "contacts",
    registry,
  );

  const resolvedDatabase = resolveDatabaseAdapterFromRegistry(database, registry);
  const queryResult = await resolvedDatabase.query("contacts", { id: "contact-1" });
  await repository.list(
    {
      filter: { email: "ada@example.test" },
      sort: [{ field: "email", direction: "asc" }],
      limit: 2,
    },
    { tenantId: "tenant-a" },
  );

  assert(
    asRecord(queryResult).source === "database-adapter",
    "database adapter must resolve through registry",
  );
  assert(
    storeAdapter.lastList?.filter?.tenantId === "tenant-a",
    "store adapter must receive tenant scope from safe repository",
  );
  assert(
    storeAdapter.lastList?.filter?.email === "ada@example.test",
    "store adapter must receive allowed filters",
  );

  return "registry-resolves-runtime-adapters";
}

function scenarioMissingAdapterFailsClosed(): string {
  const registry = createDbAdapterRegistry();
  const store = createContactsStore("missing.store").build();
  const database = createDatabaseBuilder("crm-db")
    .adapterRef("missing.database")
    .table({ id: "contacts", primaryKey: "id" })
    .build();

  assertThrows(
    () => createSafeRepositoryFromRegistry(store, "contacts", registry),
    "Missing store adapter",
  );
  assertThrows(
    () => resolveDatabaseAdapterFromRegistry(database, registry),
    "Missing database adapter",
  );

  return "missing-adapter-fails-closed";
}

async function scenarioSafeRepositoryGuardsSurviveRegistryResolution(): Promise<string> {
  const adapter = new RecordingStoreAdapter();
  const registry = createDbAdapterRegistry({
    stores: { "postgres.crm": adapter },
  });
  const repository = createSafeRepositoryFromRegistry<Record<string, unknown>>(
    createContactsStore("postgres.crm").build(),
    "contacts",
    registry,
  );

  await repository.create(
    { name: "Ada", email: "ada@example.test" },
    { tenantId: "tenant-a" },
  );
  assert(
    adapter.lastCreate?.tenantId === "tenant-a",
    "create payload must inject tenant scope",
  );
  assertThrows(
    () => repository.list({ filter: { role: "admin" } }, { tenantId: "tenant-a" }),
    'does not allow filter field "role"',
  );
  assertThrows(
    () => repository.list({ limit: 51 }, { tenantId: "tenant-a" }),
    "exceeds maxPageSize",
  );
  assertThrows(
    () => repository.update("contact-1", { email: "new@example.test" }, { tenantId: "tenant-a" }),
    'does not allow update field "email"',
  );

  return "safe-repository-guards-survive-registry-resolution";
}

function createContactsStore(adapterRef: string) {
  return createStoreBuilder("crm")
    .adapterRef(adapterRef)
    .entity("contacts", (entity) => {
      entity
        .field("tenantId", { type: "string", required: true, readonly: true, indexed: true })
        .field("name", { type: "string", required: true })
        .field("email", { type: "string", required: true, indexed: true })
        .tenantScoped("tenantId")
        .operations(["get", "list", "create", "update"])
        .filterable(["email"])
        .sortable(["email"])
        .creatable(["name", "email"])
        .updatable(["name"])
        .maxPageSize(50);
    });
}

class RecordingStoreAdapter implements StoreAdapter {
  lastList: StoreQuery | undefined;
  lastCreate: Record<string, unknown> | undefined;

  async get<TRecord>(
    _entity: StoreEntityDefinition,
    _selector: StoreRecordSelector,
    _context: StoreRuntimeContext,
  ): Promise<TRecord | null> {
    return null;
  }

  async list<TRecord>(
    _entity: StoreEntityDefinition,
    query: StoreQuery,
    _context: StoreRuntimeContext,
  ): Promise<{ items: TRecord[] }> {
    this.lastList = query;
    return { items: [] };
  }

  async create<TRecord>(
    _entity: StoreEntityDefinition,
    data: Record<string, unknown>,
    _context: StoreRuntimeContext,
  ): Promise<TRecord> {
    this.lastCreate = data;
    return data as TRecord;
  }

  async update<TRecord>(
    _entity: StoreEntityDefinition,
    _selector: StoreRecordSelector,
    data: Record<string, unknown>,
    _context: StoreRuntimeContext,
  ): Promise<TRecord> {
    return data as TRecord;
  }

  async delete(
    _entity: StoreEntityDefinition,
    _selector: StoreRecordSelector,
    _context: StoreRuntimeContext,
  ): Promise<void> {}
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}
