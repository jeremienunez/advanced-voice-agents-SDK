import type { EvaluationHarnessPort } from "../types/learning-loop/index.js";

export function createNoopEvaluationHarness(): EvaluationHarnessPort {
  return {
    evaluate() {
      return {
        status: "skipped",
        checks: [{
          name: "noop",
          status: "skipped",
          message: "No evaluation harness configured.",
        }],
      };
    },
  };
}
