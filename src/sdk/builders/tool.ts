import type { ToolDefinition, ToolRuntimeContext } from "../types/core/index.js";
import type { JsonSchema } from "../types/json.js";

export class ToolBuilder<TInput = unknown, TOutput = unknown> {
  private definition: Partial<ToolDefinition<TInput, TOutput>>;

  constructor(name: string) {
    this.definition = {
      name,
      parameters: { type: "object", properties: {}, required: [] },
      executionMode: "explicit",
    };
  }

  describe(description: string): this {
    this.definition.description = description;
    return this;
  }

  category(category: string): this {
    this.definition.category = category;
    return this;
  }

  parameters(schema: JsonSchema): this {
    this.definition.parameters = schema;
    return this;
  }

  allowedPlans(planIds: string[]): this {
    this.definition.allowedPlans = [...planIds];
    return this;
  }

  executionMode(mode: ToolDefinition["executionMode"]): this {
    this.definition.executionMode = mode;
    return this;
  }

  sideEffect(effect: ToolDefinition["sideEffect"]): this {
    this.definition.sideEffect = effect;
    return this;
  }

  voicePreamble(text: string): this {
    this.definition.voicePreamble = text;
    return this;
  }

  maxCallsPerSession(limit: number): this {
    this.definition.maxCallsPerSession = limit;
    return this;
  }

  timeoutMs(ms: number): this {
    this.definition.timeoutMs = ms;
    return this;
  }

  handler(
    execute: (
      input: TInput,
      context: ToolRuntimeContext,
    ) => Promise<TOutput>,
  ): this {
    this.definition.execute = execute;
    return this;
  }

  formatter(format: (output: TOutput, channel: string) => string): this {
    this.definition.format = format as ToolDefinition<TInput, TOutput>["format"];
    return this;
  }

  keyFacts(extract: (output: TOutput) => string[]): this {
    this.definition.keyFacts = extract;
    return this;
  }

  build(): ToolDefinition<TInput, TOutput> {
    if (!this.definition.name) throw new Error("Tool name is required");
    if (!this.definition.description) {
      throw new Error(`Tool "${this.definition.name}" needs a description`);
    }
    if (!this.definition.execute) {
      throw new Error(`Tool "${this.definition.name}" needs a handler`);
    }
    return this.definition as ToolDefinition<TInput, TOutput>;
  }
}
