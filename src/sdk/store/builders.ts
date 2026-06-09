import type {
  StoreDefinition,
  StoreEntityDefinition,
  StoreFieldDefinition,
  StoreFieldKind,
  StoreIndexDefinition,
  StoreOperation,
  StoreSearchDefinition,
} from "../types/store.js";
import {
  clone,
  defaultPolicy,
  mergeFields,
  unique,
} from "./store-policy-values.js";
import { validateEntity } from "./validation.js";
import { cloneStoreEntity } from "./clone.js";

export class StoreEntityBuilder {
  private readonly definition: StoreEntityDefinition;

  constructor(id: string) {
    this.definition = {
      id,
      primaryKey: "id",
      fields: [
        {
          id: "id",
          type: "id",
          required: true,
          readonly: true,
          unique: true,
          indexed: true,
        },
      ],
      indexes: [],
      policy: defaultPolicy(),
    };
  }

  displayName(value: string): this {
    this.definition.displayName = value;
    return this;
  }

  describe(value: string): this {
    this.definition.description = value;
    return this;
  }

  primaryKey(fieldId: string): this {
    this.definition.primaryKey = fieldId;
    return this;
  }

  field(
    id: string,
    definition: StoreFieldKind | Omit<StoreFieldDefinition, "id">,
  ): this {
    const field =
      typeof definition === "string"
        ? { id, type: definition }
        : { id, ...definition };
    this.definition.fields.push(field);
    return this;
  }

  index(definition: StoreIndexDefinition): this {
    this.definition.indexes.push(clone(definition));
    return this;
  }

  operations(operations: StoreOperation[]): this {
    this.definition.policy.allowedOperations = [...operations];
    return this;
  }

  tenantScoped(fieldId = "tenantId"): this {
    this.ensureScopeField(fieldId);
    this.definition.policy.tenantField = fieldId;
    this.definition.policy.scope =
      this.definition.policy.scope === "user" ? "tenant-user" : "tenant";
    this.filterable([fieldId]);
    return this;
  }

  userScoped(fieldId = "userId"): this {
    this.ensureScopeField(fieldId);
    this.definition.policy.userField = fieldId;
    this.definition.policy.scope =
      this.definition.policy.scope === "tenant" ? "tenant-user" : "user";
    this.filterable([fieldId]);
    return this;
  }

  customScoped(): this {
    this.definition.policy.scope = "custom";
    return this;
  }

  filterable(fields: string[]): this {
    this.definition.policy.allowedFilterFields = mergeFields(
      this.definition.policy.allowedFilterFields,
      fields,
    );
    return this;
  }

  sortable(fields: string[]): this {
    this.definition.policy.allowedSortFields = mergeFields(
      this.definition.policy.allowedSortFields,
      fields,
    );
    return this;
  }

  creatable(fields: string[]): this {
    this.definition.policy.allowedCreateFields = [...fields];
    return this;
  }

  updatable(fields: string[]): this {
    this.definition.policy.allowedUpdateFields = [...fields];
    return this;
  }

  maxPageSize(limit: number): this {
    this.definition.policy.maxPageSize = limit;
    return this;
  }

  softDelete(fieldId = "deletedAt"): this {
    this.definition.policy.softDeleteField = fieldId;
    this.definition.timestamps = {
      ...this.definition.timestamps,
      deletedAt: fieldId,
    };
    if (!this.hasField(fieldId)) {
      this.field(fieldId, {
        type: "date",
        nullable: true,
        readonly: true,
        indexed: true,
      });
    }
    return this;
  }

  timestamps(
    fields: StoreEntityDefinition["timestamps"] = {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  ): this {
    this.definition.timestamps = { ...this.definition.timestamps, ...fields };
    for (const fieldId of Object.values(fields ?? {})) {
      if (fieldId && !this.hasField(fieldId)) {
        this.field(fieldId, {
          type: "date",
          readonly: true,
          indexed: true,
        });
      }
    }
    return this;
  }

  search(definition: StoreSearchDefinition): this {
    this.definition.search = clone(definition);
    if (!this.definition.policy.allowedOperations.includes("search")) {
      this.definition.policy.allowedOperations.push("search");
    }
    return this;
  }

  build(): StoreEntityDefinition {
    const fieldIds = this.definition.fields.map((field) => field.id);
    unique(fieldIds, `field in store entity "${this.definition.id}"`);
    unique(
      this.definition.indexes.map((index) => index.id),
      `index in store entity "${this.definition.id}"`,
    );

    if (!fieldIds.includes(this.definition.primaryKey)) {
      throw new Error(
        `Store entity "${this.definition.id}" primary key "${this.definition.primaryKey}" is not a field`,
      );
    }

    this.normalizePolicy();
    validateEntity(this.definition);
    return cloneStoreEntity(this.definition);
  }

  private ensureScopeField(fieldId: string): void {
    if (this.hasField(fieldId)) return;
    this.field(fieldId, {
      type: "string",
      required: true,
      readonly: true,
      indexed: true,
    });
  }

  private hasField(fieldId: string): boolean {
    return this.definition.fields.some((field) => field.id === fieldId);
  }

  private normalizePolicy(): void {
    const writableFields = this.definition.fields
      .filter((field) => {
        return (
          !field.readonly &&
          field.id !== this.definition.primaryKey &&
          field.id !== this.definition.policy.tenantField &&
          field.id !== this.definition.policy.userField
        );
      })
      .map((field) => field.id);

    const indexedFields = this.definition.fields
      .filter((field) => field.indexed || field.unique)
      .map((field) => field.id);

    if (this.definition.policy.allowedCreateFields.length === 0) {
      this.definition.policy.allowedCreateFields = [...writableFields];
    }
    if (this.definition.policy.allowedUpdateFields.length === 0) {
      this.definition.policy.allowedUpdateFields = [...writableFields];
    }
    if (this.definition.policy.allowedFilterFields.length === 0) {
      this.definition.policy.allowedFilterFields = [
        this.definition.primaryKey,
        ...indexedFields,
      ];
    }
    if (this.definition.policy.allowedSortFields.length === 0) {
      this.definition.policy.allowedSortFields = [...indexedFields];
    }
  }
}

export class StoreBuilder {
  private readonly definition: StoreDefinition;

  constructor(id: string) {
    this.definition = {
      id,
      entities: [],
    };
  }

  displayName(value: string): this {
    this.definition.displayName = value;
    return this;
  }

  adapterRef(ref: string): this {
    this.definition.adapterRef = ref;
    return this;
  }

  describe(value: string): this {
    this.definition.description = value;
    return this;
  }

  entity(id: string, configure: (builder: StoreEntityBuilder) => void): this {
    const builder = new StoreEntityBuilder(id);
    configure(builder);
    this.definition.entities.push(builder.build());
    return this;
  }

  entityDefinition(definition: StoreEntityDefinition): this {
    validateEntity(definition);
    this.definition.entities.push(definition);
    return this;
  }

  build(): StoreDefinition {
    unique(this.definition.entities.map((entity) => entity.id), "store entity");
    return {
      ...this.definition,
      entities: this.definition.entities.map(cloneStoreEntity),
    };
  }
}

export function createStoreBuilder(id: string): StoreBuilder {
  return new StoreBuilder(id);
}
