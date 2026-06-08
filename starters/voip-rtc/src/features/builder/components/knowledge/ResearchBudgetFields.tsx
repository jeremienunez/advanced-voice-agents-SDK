import { NumberField } from "../../../../components/ui/NumberField.js";
import type { KnowledgeResearchBudget } from "../../../../domain/builder/knowledge.js";

export function ResearchBudgetFields({
  budget,
  updateResearchBudget,
}: {
  budget: KnowledgeResearchBudget;
  updateResearchBudget: (key: keyof KnowledgeResearchBudget, value: number) => void;
}) {
  return (
    <div className="budgetGrid">
      <NumberField
        label="Cycles max"
        max={12}
        min={1}
        name="researchCycles"
        value={budget.maxCycles}
        onValueChange={(value) => updateResearchBudget("maxCycles", value)}
      />
      <NumberField
        label="Requêtes / checkpoint"
        max={32}
        min={1}
        name="researchQueries"
        value={budget.maxQueriesPerCycle}
        onValueChange={(value) =>
          updateResearchBudget("maxQueriesPerCycle", value)
        }
      />
      <NumberField
        label="Sources max"
        max={200}
        min={1}
        name="researchSources"
        value={budget.maxSources}
        onValueChange={(value) => updateResearchBudget("maxSources", value)}
      />
      <NumberField
        label="Tokens max"
        max={250000}
        min={2000}
        name="researchTokens"
        step={1000}
        value={budget.maxEstimatedTokens}
        onValueChange={(value) =>
          updateResearchBudget("maxEstimatedTokens", value)
        }
      />
      <NumberField
        label="Budget max (USD)"
        max={50}
        min={0.01}
        name="researchCost"
        step={0.01}
        value={budget.maxEstimatedCostUsd}
        onValueChange={(value) =>
          updateResearchBudget("maxEstimatedCostUsd", value)
        }
      />
    </div>
  );
}
