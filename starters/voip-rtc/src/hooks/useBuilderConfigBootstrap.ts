import { useEffect, type Dispatch, type SetStateAction } from "react";
import { fetchBuilderConfig } from "../api/builderApi.js";
import type {
  BuilderConfig,
  BuilderIdentity,
  BuilderResearchSettings,
  KnowledgeResearchBudget,
} from "../domain/builder.js";

export function useBuilderConfigBootstrap({
  apiBase,
  setConfig,
  setConfigError,
  setForm,
  setResearchBudget,
  setResearchSettings,
  setSelectedTools,
}: {
  apiBase: string;
  setConfig: Dispatch<SetStateAction<BuilderConfig | null>>;
  setConfigError: Dispatch<SetStateAction<string | null>>;
  setForm: Dispatch<SetStateAction<BuilderIdentity>>;
  setResearchBudget: Dispatch<SetStateAction<KnowledgeResearchBudget>>;
  setResearchSettings: Dispatch<SetStateAction<BuilderResearchSettings>>;
  setSelectedTools: Dispatch<SetStateAction<string[]>>;
}) {
  useEffect(() => {
    const controller = new AbortController();
    async function loadConfig() {
      try {
        const nextConfig = await fetchBuilderConfig(apiBase, controller.signal);
        setConfig(nextConfig);
        setForm((current) => ({
          ...current,
          llmProvider: current.llmProvider || nextConfig.defaults.promptProvider,
          llmModel: current.llmModel || nextConfig.defaults.deepseekModel,
        }));
        setResearchSettings({
          provider: nextConfig.defaults.researchProvider,
          model: nextConfig.defaults.researchModel,
          verifierProvider: nextConfig.defaults.knowledgeVerificationProvider,
          verifierModel: nextConfig.defaults.knowledgeVerificationModel,
          verificationPasses: nextConfig.defaults.knowledgeVerificationPasses,
        });
        setResearchBudget(nextConfig.defaults.researchBudget);
        setSelectedTools(
          nextConfig.toolRegistry
            .filter((item) => item.selectedByDefault)
            .map((item) => item.name),
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        setForm((current) => ({
          ...current,
          llmProvider: current.llmProvider || "deepseek",
          llmModel: current.llmModel || "deepseek-v4-pro",
        }));
        setConfigError(
          error instanceof Error ? error.message : "Failed to load builder config",
        );
      }
    }
    void loadConfig();
    return () => controller.abort();
  }, [
    apiBase,
    setConfig,
    setConfigError,
    setForm,
    setResearchBudget,
    setResearchSettings,
    setSelectedTools,
  ]);
}
