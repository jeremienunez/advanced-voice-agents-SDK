import type { StoreAdapterContract } from "./adapter-contracts.js";
import type { StoreAdapter } from "./types.js";

export interface StoreAdapterBinding {
  adapter: StoreAdapter;
  contract?: StoreAdapterContract;
}

export function createStoreAdapterBinding(
  adapter: StoreAdapter,
  contract?: StoreAdapterContract,
): StoreAdapterBinding {
  return { adapter, contract };
}
