import type { DomainPack } from "../types/core/index.js";
import type { ToolRegistryItem } from "../types/draft.js";
import { copy } from "./builder-values.js";

export function defineToolRegistryItem(item: ToolRegistryItem): ToolRegistryItem {
  return copy(item);
}

export function defineDomainPack(pack: DomainPack): DomainPack {
  return pack;
}
