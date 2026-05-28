import {
  createDbAdapterRegistry,
  createDocumentStoreAdapterContract,
  createSafeRepositoryFromRegistry,
  createSqlStoreAdapterContract,
  createStoreAdapterBinding,
  createStoreBuilder,
  createVectorStoreAdapterContract,
  resolveStoreAdapterBindingFromRegistry,
  type StoreAdapter,
  type StoreEntityDefinition,
  type StoreQuery,
  type StoreRecordSelector,
  type StoreRuntimeContext,
} from "@voiceagentsdk/core/sdk";
import { assert, assertThrows } from "./shared/assertions.js";

const results = [
  scenarioSqlDocumentVectorMappingsStayAdapterOwned(),
  scenarioRegistryResolvesBindingsAndValidatesSoftDeletePolicy(),
  await scenarioSafeRepositoryBoundsPaginationBeforeAdapter(),
  scenarioMigrationsArePlansAndMustBeExplicit(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioSqlDocumentVectorMappingsStayAdapterOwned(): string {
  const store = createContactsStore().build();
  const sql = createSqlStoreAdapterContract({
    fields: [{
      entity: "contacts",
      field: "email",
      target: "crm_contacts.email_address",
    }],
    indexes: [{
      entity: "contacts",
      index: "contacts_email_idx",
      target: "idx_crm_contacts_email",
    }],
    pagination: { mode: "cursor", cursorField: "id" },
    softDelete: { entity: "contacts", field: "deletedAt", mode: "timestamp" },
  });
  const document = createDocumentStoreAdapterContract({
    fields: [{ entity: "contacts", field: "email", target: "profile.email" }],
    indexes: [{ entity: "contacts", index: "contacts_email_idx", target: "email_1" }],
    pagination: { mode: "cursor", cursorField: "_id" },
  });
  const vector = createVectorStoreAdapterContract({
    fields: [{ entity: "contacts", field: "embedding", target: "vectors.embedding" }],
    indexes: [{ entity: "contacts", index: "contacts_embedding_idx", target: "hnsw_embedding" }],
    pagination: { mode: "cursor", cursorField: "vector_cursor" },
  });
  const serializedStore = JSON.stringify(store);

  assert(
    [sql.kind, document.kind, vector.kind].join(",") === "sql,document,vector",
    "contract factories must identify SQL, document, and vector adapters",
  );
  assert(!serializedStore.includes("crm_contacts"), "SQL mapping must be adapter-owned");
  assert(!serializedStore.includes("profile.email"), "document mapping must be adapter-owned");
  assert(!serializedStore.includes("hnsw_embedding"), "vector mapping must be adapter-owned");

  return "sql-document-vector-mappings-stay-adapter-owned";
}

function scenarioRegistryResolvesBindingsAndValidatesSoftDeletePolicy(): string {
  const store = createContactsStore().build();
  const binding = createStoreAdapterBinding(
    new RecordingStoreAdapter(),
    createSqlStoreAdapterContract({
      fields: [{ entity: "contacts", field: "deletedAt", target: "crm_contacts.deleted_at" }],
      pagination: { mode: "cursor", cursorField: "id" },
      softDelete: { entity: "contacts", field: "deletedAt", mode: "timestamp" },
    }),
  );
  const registry = createDbAdapterRegistry({
    stores: { "postgres.crm": binding },
  });
  const resolved = resolveStoreAdapterBindingFromRegistry(store, registry);

  assert(
    resolved.contract?.softDelete?.field === "deletedAt",
    "resolved binding must expose policy-driven soft delete metadata",
  );
  assertThrows(
    () => resolveStoreAdapterBindingFromRegistry(
      store,
      createDbAdapterRegistry({
        stores: {
          "postgres.crm": createStoreAdapterBinding(
            new RecordingStoreAdapter(),
            createSqlStoreAdapterContract({
              fields: [],
              pagination: { mode: "cursor", cursorField: "id" },
              softDelete: { entity: "contacts", field: "archivedAt", mode: "timestamp" },
            }),
          ),
        },
      }),
    ),
    "soft delete field",
  );

  return "registry-resolves-bindings-and-validates-soft-delete-policy";
}

async function scenarioSafeRepositoryBoundsPaginationBeforeAdapter(): Promise<string> {
  const store = createContactsStore().build();
  const adapter = new RecordingStoreAdapter();
  const registry = createDbAdapterRegistry({
    stores: {
      "postgres.crm": createStoreAdapterBinding(
        adapter,
        createDocumentStoreAdapterContract({
          fields: [{ entity: "contacts", field: "email", target: "email" }],
          pagination: { mode: "cursor", cursorField: "_id" },
        }),
      ),
    },
  });
  const repository = createSafeRepositoryFromRegistry(store, "contacts", registry);

  assertThrows(
    () => repository.list({ limit: 51 }, { tenantId: "tenant-a" }),
    "exceeds maxPageSize",
  );
  assert(adapter.listCalls === 0, "oversized pagination must not reach adapter");
  await repository.list({ limit: 2 }, { tenantId: "tenant-a" });
  assert(adapter.lastList?.limit === 2, "safe pagination must reach adapter");

  return "safe-repository-bounds-pagination-before-adapter";
}

function scenarioMigrationsArePlansAndMustBeExplicit(): string {
  const store = createContactsStore().build();
  const contract = createSqlStoreAdapterContract({
    fields: [{ entity: "contacts", field: "email", target: "crm_contacts.email_address" }],
    pagination: { mode: "cursor", cursorField: "id" },
    migrations: [{ id: "001_contacts", description: "Create contacts table" }],
  });

  assert(contract.migrations?.[0]?.id === "001_contacts", "migration plans must stay on adapter contract");
  assert(!JSON.stringify(store).includes("001_contacts"), "SDK store definitions must not carry migrations");
  assertThrows(
    () => createSqlStoreAdapterContract({
      fields: [],
      migrations: [{
        id: "bad",
        description: "Attempts to execute from contract",
        apply: () => undefined,
      } as never],
    }),
    "Migration execution",
  );

  return "migrations-are-plans-and-must-be-explicit";
}

function createContactsStore() {
  return createStoreBuilder("crm")
    .adapterRef("postgres.crm")
    .entity("contacts", (entity) => {
      entity
        .field("tenantId", { type: "string", required: true, readonly: true, indexed: true })
        .field("email", { type: "string", required: true, indexed: true })
        .field("deletedAt", { type: "date", nullable: true, readonly: true, indexed: true })
        .field("embedding", { type: "vector", dimensions: 1536 })
        .index({ id: "contacts_email_idx", fields: ["tenantId", "email"] })
        .index({ id: "contacts_embedding_idx", fields: ["embedding"] })
        .tenantScoped("tenantId")
        .softDelete("deletedAt")
        .operations(["list", "delete"])
        .filterable(["email"])
        .sortable(["email"])
        .maxPageSize(50);
    });
}

class RecordingStoreAdapter implements StoreAdapter {
  listCalls = 0;
  lastList: StoreQuery | undefined;

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
    this.listCalls++;
    this.lastList = query;
    return { items: [] };
  }

  async create<TRecord>(
    _entity: StoreEntityDefinition,
    data: Record<string, unknown>,
    _context: StoreRuntimeContext,
  ): Promise<TRecord> {
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
