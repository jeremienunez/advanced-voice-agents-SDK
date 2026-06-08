import { fail } from "../fixtures/learning-bdd/assert.js";
import { runLearningBddScenarios } from "../fixtures/learning-bdd/scenarios.js";

try {
  const results = await runLearningBddScenarios();
  console.log(JSON.stringify({
    status: "ok",
    style: "bdd-popperian",
    results,
  }, null, 2));
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
