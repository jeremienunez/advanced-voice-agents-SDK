import { useState, type Dispatch, type SetStateAction } from "react";
import {
  createPromptPlan,
  savePromptClarifications,
} from "../api/builderApi.js";
import type {
  AgentBuildDraft,
  BuilderIdentity,
} from "../domain/builder/types.js";
import { keepLoaderVisible } from "../domain/builder/progress.js";

export function useBuilderPromptPlanning({
  apiBase,
  form,
  draft,
  setDraft,
  setSelectedTools,
  setBusy,
  setMessage,
}: {
  apiBase: string;
  form: BuilderIdentity;
  draft: AgentBuildDraft | null;
  setDraft: Dispatch<SetStateAction<AgentBuildDraft | null>>;
  setSelectedTools: Dispatch<SetStateAction<string[]>>;
  setBusy: Dispatch<SetStateAction<string | null>>;
  setMessage: Dispatch<SetStateAction<string | null>>;
}) {
  const [promptAnswers, setPromptAnswers] = useState<Record<string, string>>({});

  async function analyzeIntent() {
    const startedAt = performance.now();
    setBusy("prompt");
    setMessage(null);
    try {
      const response = await createPromptPlan(apiBase, form);
      setDraft(response.draft);
      setSelectedTools(response.draft.selectedTools);
      setPromptAnswers({});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Prompt planning failed");
    } finally {
      await keepLoaderVisible(startedAt);
      setBusy(null);
    }
  }

  const updatePromptAnswer = (questionId: string, value: string) => {
    setPromptAnswers((current) => ({ ...current, [questionId]: value }));
  };

  async function confirmPromptPlan() {
    if (!draft?.promptPlan) return true;
    const startedAt = performance.now();
    setBusy("prompt-confirm");
    setMessage(null);
    try {
      const response = await savePromptClarifications(
        apiBase,
        draft,
        promptAnswers,
      );
      setDraft(response.draft);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Prompt confirmation failed");
      return false;
    } finally {
      await keepLoaderVisible(startedAt, 350);
      setBusy(null);
    }
  }

  return {
    promptAnswers,
    analyzeIntent,
    confirmPromptPlan,
    updatePromptAnswer,
  };
}
