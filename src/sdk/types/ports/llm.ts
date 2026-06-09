import type {
  LlmResolvedModel,
  LlmTask,
  LlmTaskResult,
} from "../llm.js";

export interface LlmModelResolverPort {
  resolveModel(input: LlmTask): Promise<LlmResolvedModel> | LlmResolvedModel;
}

export interface LlmTaskRunnerPort {
  run<TOutput = unknown>(input: LlmTask): Promise<LlmTaskResult<TOutput>>;
}
