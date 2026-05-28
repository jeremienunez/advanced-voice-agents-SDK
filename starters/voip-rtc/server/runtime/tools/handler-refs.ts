import { actionToolRegistryAdapter } from "./action-tool-registry.js";

export const knowledgeToolHandlerRef = "knowledge.search";

export function runtimeToolHandlerRefs(): string[] {
  return [
    knowledgeToolHandlerRef,
    ...actionToolRegistryAdapter.availableHandlerRefs(),
  ];
}
