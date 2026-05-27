import type {
  AgentBuilderIdentity,
  AgentBuildDraft,
  AgentBuildDraftStatus,
  CompiledAgentArtifact,
  DatabaseBuildPlan,
  AgentInfraPlan,
  KnowledgeBuildPlan,
  PromptBuildPlan,
  ToolBuildPlan,
  ToolName,
  ToolRegistryItem,
  ToolValidationReport,
} from "../types.js";
import { assertUnique, copy } from "./builder-values.js";

export class AgentBuildDraftBuilder {
  private readonly draft: AgentBuildDraft;

  constructor(id: string, identity: AgentBuilderIdentity) {
    const now = new Date().toISOString();
    this.draft = {
      id,
      status: "draft",
      identity: copy(identity),
      toolRegistry: [],
      selectedTools: [],
      promptParts: {},
      createdAt: now,
      updatedAt: now,
    };
  }

  status(status: AgentBuildDraftStatus): this {
    this.draft.status = status;
    this.touch();
    return this;
  }

  promptPlan(plan: PromptBuildPlan): this {
    this.draft.promptPlan = copy(plan);
    this.draft.promptParts.part1 = plan.promptPart1;
    this.draft.status = "prompt-planned";
    this.touch();
    return this;
  }

  knowledgePlan(plan: KnowledgeBuildPlan): this {
    this.draft.knowledgePlan = copy(plan);
    this.draft.status = "knowledge-planned";
    this.touch();
    return this;
  }

  databasePlan(plan: DatabaseBuildPlan): this {
    this.draft.databasePlan = copy(plan);
    this.draft.status =
      plan.status === "applied" ? "database-applied" : "database-planned";
    this.touch();
    return this;
  }

  infraPlan(plan: AgentInfraPlan): this {
    this.draft.infraPlan = copy(plan);
    this.touch();
    return this;
  }

  toolBuildPlan(plan: ToolBuildPlan): this {
    this.draft.toolBuildPlan = copy(plan);
    this.touch();
    return this;
  }

  toolValidation(report: ToolValidationReport): this {
    this.draft.toolValidation = copy(report);
    this.touch();
    return this;
  }

  registry(items: ToolRegistryItem[]): this {
    this.draft.toolRegistry = items.map((item) => copy(item));
    this.touch();
    return this;
  }

  selectTools(toolNames: ToolName[]): this {
    this.draft.selectedTools = [...toolNames];
    this.touch();
    return this;
  }

  toolPrompt(prompt: string): this {
    this.draft.promptParts.tools = prompt;
    this.touch();
    return this;
  }

  finalPrompt(prompt: string): this {
    this.draft.promptParts.final = prompt;
    this.touch();
    return this;
  }

  compiled(artifact: CompiledAgentArtifact): this {
    this.draft.compiled = copy(artifact);
    this.draft.status = "compiled";
    this.touch();
    return this;
  }

  metadata(metadata: Record<string, unknown>): this {
    this.draft.metadata = { ...(this.draft.metadata ?? {}), ...metadata };
    this.touch();
    return this;
  }

  build(): AgentBuildDraft {
    if (!this.draft.id) throw new Error("Draft id is required");
    if (!this.draft.identity.publicAgentName) {
      throw new Error("Draft public agent name is required");
    }
    if (!this.draft.identity.intent) {
      throw new Error("Draft intent is required");
    }
    assertUnique(
      this.draft.toolRegistry.map((item) => item.name),
      "tool registry item",
    );
    return {
      ...this.draft,
      identity: copy(this.draft.identity),
      promptPlan: this.draft.promptPlan ? copy(this.draft.promptPlan) : undefined,
      knowledgePlan: this.draft.knowledgePlan
        ? copy(this.draft.knowledgePlan)
        : undefined,
      databasePlan: this.draft.databasePlan
        ? copy(this.draft.databasePlan)
        : undefined,
      infraPlan: this.draft.infraPlan ? copy(this.draft.infraPlan) : undefined,
      toolBuildPlan: this.draft.toolBuildPlan
        ? copy(this.draft.toolBuildPlan)
        : undefined,
      toolValidation: this.draft.toolValidation
        ? copy(this.draft.toolValidation)
        : undefined,
      toolRegistry: this.draft.toolRegistry.map((item) => copy(item)),
      selectedTools: [...this.draft.selectedTools],
      promptParts: { ...this.draft.promptParts },
      compiled: this.draft.compiled ? copy(this.draft.compiled) : undefined,
      metadata: this.draft.metadata ? { ...this.draft.metadata } : undefined,
    };
  }

  private touch(): void {
    this.draft.updatedAt = new Date().toISOString();
  }
}
