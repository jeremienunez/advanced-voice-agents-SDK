import type {
  AgentEvolutionInput,
  AgentEvolutionPort,
  AgentEvolutionResult,
} from "@voiceagentsdk/core/sdk";
import { assert } from "./assert.js";

export class RecordingEvolution implements AgentEvolutionPort {
  readonly calls: AgentEvolutionInput[] = [];
  lastInput: AgentEvolutionInput | null = null;
  private version = 1;

  async validateAndApply(
    input: AgentEvolutionInput,
  ): Promise<AgentEvolutionResult> {
    this.calls.push(input);
    this.lastInput = input;

    assert(input.memories.length > 0, "evolution requires learned memories");
    assert(input.graph.nodes.length > 0, "evolution requires graph nodes");
    assert(input.graph.edges.length > 0, "evolution requires graph edges");
    assert(
      input.memories.every((memory) => !memory.text.includes("sk-test-secret-value")),
      "evolution must never receive unredacted secret-looking memories",
    );

    this.version += 1;
    return {
      status: "applied",
      draftId: input.draftId,
      version: this.version,
      previousVersion: this.version - 1,
      artifactId: `artifact_${input.draftId}_v${this.version}`,
      rollbackArtifactId: `artifact_${input.draftId}_v${this.version - 1}`,
      auditId: `audit_${input.runId}`,
      reason: "BDD fake evolution accepted learning payload.",
    };
  }
}
