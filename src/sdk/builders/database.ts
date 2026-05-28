import type {
  DatabaseCollectionDefinition,
  DatabaseDefinition,
  DatabaseResourceId,
  DatabaseTableDefinition,
  DatabaseVectorIndexDefinition,
} from "../types.js";
import { assertUnique, copy } from "./builder-values.js";

export class DatabaseBuilder {
  private readonly definition: DatabaseDefinition;

  constructor(id: string) {
    this.definition = {
      id,
      tables: [],
      collections: [],
      vectorIndexes: [],
      kvNamespaces: [],
    };
  }

  displayName(name: string): this {
    this.definition.displayName = name;
    return this;
  }

  adapterRef(ref: string): this {
    this.definition.adapterRef = ref;
    return this;
  }

  table(definition: DatabaseTableDefinition): this {
    this.definition.tables.push(copy(definition));
    return this;
  }

  collection(definition: DatabaseCollectionDefinition): this {
    this.definition.collections.push(copy(definition));
    return this;
  }

  vectorIndex(definition: DatabaseVectorIndexDefinition): this {
    this.definition.vectorIndexes.push(copy(definition));
    return this;
  }

  kvNamespace(id: DatabaseResourceId): this {
    this.definition.kvNamespaces.push(id);
    return this;
  }

  build(): DatabaseDefinition {
    assertUnique(this.definition.tables.map((item) => item.id), "table");
    assertUnique(
      this.definition.collections.map((item) => item.id),
      "collection",
    );
    assertUnique(
      this.definition.vectorIndexes.map((item) => item.id),
      "vector index",
    );
    assertUnique(this.definition.kvNamespaces, "kv namespace");
    return {
      ...this.definition,
      tables: [...this.definition.tables],
      collections: [...this.definition.collections],
      vectorIndexes: [...this.definition.vectorIndexes],
      kvNamespaces: [...this.definition.kvNamespaces],
    };
  }
}
