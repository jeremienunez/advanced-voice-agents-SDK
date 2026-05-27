import type {
  JsonObject,
  KnowledgeResearchCheckpoint,
  KnowledgeResearchCycle,
} from "@voiceagentsdk/core/sdk";

export function pushResearchCheckpoint(
  cycle: KnowledgeResearchCycle,
  input: {
    detail?: string;
    label: string;
    metadata?: JsonObject;
    status: KnowledgeResearchCheckpoint["status"];
  },
): KnowledgeResearchCheckpoint {
  const checkpoint: KnowledgeResearchCheckpoint = {
    id: `checkpoint_${crypto.randomUUID()}`,
    label: input.label,
    status: input.status,
    at: new Date().toISOString(),
    detail: input.detail,
    metadata: input.metadata,
  };
  cycle.checkpoints = [...(cycle.checkpoints ?? []), checkpoint];
  return checkpoint;
}

export function flattenResearchCheckpoints(
  cycles: KnowledgeResearchCycle[],
): KnowledgeResearchCheckpoint[] {
  return cycles.flatMap((cycle) => cycle.checkpoints ?? []);
}
