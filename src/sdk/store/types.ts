import type { StoreEntityDefinition } from "../types.js";

export interface StoreRuntimeContext {
  tenantId?: string;
  userId?: string;
  planId?: string;
  metadata?: Record<string, unknown>;
}

export interface StoreRecordSelector {
  id: string;
  scope: Record<string, unknown>;
}

export interface StoreSort {
  field: string;
  direction: "asc" | "desc";
}

export interface StoreQuery {
  filter?: Record<string, unknown>;
  sort?: StoreSort[];
  limit?: number;
  cursor?: string;
}

export interface StoreSearchQuery extends StoreQuery {
  query?: string;
  vector?: number[];
}

export interface StorePage<TRecord> {
  items: TRecord[];
  nextCursor?: string;
  total?: number;
}

export interface StoreAdapter {
  get<TRecord>(
    entity: StoreEntityDefinition,
    selector: StoreRecordSelector,
    context: StoreRuntimeContext,
  ): Promise<TRecord | null>;
  list<TRecord>(
    entity: StoreEntityDefinition,
    query: StoreQuery,
    context: StoreRuntimeContext,
  ): Promise<StorePage<TRecord>>;
  search?<TRecord>(
    entity: StoreEntityDefinition,
    query: StoreSearchQuery,
    context: StoreRuntimeContext,
  ): Promise<StorePage<TRecord>>;
  create<TRecord>(
    entity: StoreEntityDefinition,
    data: Record<string, unknown>,
    context: StoreRuntimeContext,
  ): Promise<TRecord>;
  update<TRecord>(
    entity: StoreEntityDefinition,
    selector: StoreRecordSelector,
    data: Record<string, unknown>,
    context: StoreRuntimeContext,
  ): Promise<TRecord>;
  delete(
    entity: StoreEntityDefinition,
    selector: StoreRecordSelector,
    context: StoreRuntimeContext,
  ): Promise<void>;
  upsert?<TRecord>(
    entity: StoreEntityDefinition,
    data: Record<string, unknown>,
    context: StoreRuntimeContext,
  ): Promise<TRecord>;
}

export interface SafeRepository<TRecord = Record<string, unknown>> {
  readonly definition: StoreEntityDefinition;
  get(id: string, context: StoreRuntimeContext): Promise<TRecord | null>;
  list(query: StoreQuery, context: StoreRuntimeContext): Promise<StorePage<TRecord>>;
  search(
    query: StoreSearchQuery,
    context: StoreRuntimeContext,
  ): Promise<StorePage<TRecord>>;
  create(
    data: Record<string, unknown>,
    context: StoreRuntimeContext,
  ): Promise<TRecord>;
  update(
    id: string,
    data: Record<string, unknown>,
    context: StoreRuntimeContext,
  ): Promise<TRecord>;
  delete(id: string, context: StoreRuntimeContext): Promise<void>;
  upsert(
    data: Record<string, unknown>,
    context: StoreRuntimeContext,
  ): Promise<TRecord>;
}
