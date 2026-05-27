import { ToolBuilder } from "./tool.js";

export function createToolBuilder<TInput = unknown, TOutput = unknown>(
  name: string,
): ToolBuilder<TInput, TOutput> {
  return new ToolBuilder<TInput, TOutput>(name);
}
