import type { DomainPack, ToolRegistryItem } from "../types.js";
import { copy } from "./utils.js";

export function defineToolRegistryItem(item: ToolRegistryItem): ToolRegistryItem {
  return copy(item);
}

export function defineDomainPack(pack: DomainPack): DomainPack {
  return pack;
}
