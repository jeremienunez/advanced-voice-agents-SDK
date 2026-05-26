import { Metric } from "../../../components/ui/Metric.js";
import { Panel } from "../../../components/ui/Panel.js";
import type { AgentBuildDraft } from "../../../domain/builder.js";

export function PromptPlanPanel({
  draft,
  answers,
  busy,
  updateAnswer,
  confirmPromptPlan,
}: {
  draft: AgentBuildDraft | null;
  answers: Record<string, string>;
  busy: string | null;
  updateAnswer: (questionId: string, value: string) => void;
  confirmPromptPlan: () => Promise<boolean>;
}) {
  const questions = draft?.promptPlan?.questions ?? [];

  return (
    <Panel title="2. Builder LLM Plan">
      {draft?.promptPlan ? (
        <>
          <div className="decisionGrid">
            <Metric
              label="Voice"
              value={`${draft.promptPlan.recommendedVoice.voice} - ${draft.promptPlan.recommendedVoice.tone}`}
            />
            <Metric
              label="Confidence"
              value={`${Math.round((draft.promptPlan.confidence ?? 0) * 100)}%`}
            />
          </div>
          <div className="promptBlueprintGrid">
            <section className="promptQuestionStack">
              <h3>Questions à trancher</h3>
              {questions.length > 0 ? (
                questions.map((question) => (
                  <label key={question.id} className="promptQuestionCard">
                    <span>{question.label}</span>
                    <textarea
                      value={answers[question.id] ?? ""}
                      placeholder="Réponse courte, ou laissez vide pour valider l'hypothèse du builder."
                      onChange={(event) => updateAnswer(question.id, event.target.value)}
                    />
                  </label>
                ))
              ) : (
                <p className="muted">Aucune question bloquante restante.</p>
              )}
              <button
                className="primary promptConfirmButton"
                disabled={Boolean(busy)}
                type="button"
                onClick={() => void confirmPromptPlan()}
              >
                Valider le blueprint
              </button>
            </section>
            <section className="promptAssumptionStack">
              <h3>Hypothèses validées</h3>
              {draft.promptPlan.assumptions.map((item) => (
                <p key={item} className="assumptionLine">
                  {item}
                </p>
              ))}
            </section>
          </div>
        </>
      ) : (
        <p className="muted">
          The selected builder model will compose prompt part 1 after step 1.
        </p>
      )}
    </Panel>
  );
}
