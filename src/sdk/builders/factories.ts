import type {
  AgentBuilderIdentity,
  DomainPack,
  ToolRegistryItem,
} from "../types.js";
import { AgentBuilder } from "./agent.js";
import { AgentBuildDraftBuilder } from "./draft.js";
import { DatabaseBuilder } from "./database.js";
import { ToolBuilder } from "./tool.js";
import { copy } from "./utils.js";

export function createAgentBuilder(): AgentBuilder {
  return new AgentBuilder();
}

export function createToolBuilder<TInput = unknown, TOutput = unknown>(
  name: string,
): ToolBuilder<TInput, TOutput> {
  return new ToolBuilder<TInput, TOutput>(name);
}

export function createDatabaseBuilder(id: string): DatabaseBuilder {
  return new DatabaseBuilder(id);
}

export function createAgentBuildDraftBuilder(
  id: string,
  identity: AgentBuilderIdentity,
): AgentBuildDraftBuilder {
  return new AgentBuildDraftBuilder(id, identity);
}

export function defineToolRegistryItem(item: ToolRegistryItem): ToolRegistryItem {
  return copy(item);
}

export function defineDomainPack(pack: DomainPack): DomainPack {
  return pack;
}
