import { useEffect, type Dispatch, type SetStateAction } from "react";
import { fetchBuilderConfig } from "../api/builderApi.js";
import type {
  BuilderConfig,
  BuilderResearchSettings,
  BuilderSystemConfig,
} from "../domain/builder/types.js";
import type {
  KnowledgeResearchBudget,
} from "../domain/builder/knowledge.js";

export function useBuilderConfigBootstrap({
  apiBase,
  setConfig,
  setConfigError,
  setResearchBudget,
  setResearchSettings,
  setBuilderSystem,
  setSelectedTools,
}: {
  apiBase: string;
  setConfig: Dispatch<SetStateAction<BuilderConfig | null>>;
  setConfigError: Dispatch<SetStateAction<string | null>>;
  setResearchBudget: Dispatch<SetStateAction<KnowledgeResearchBudget>>;
  setResearchSettings: Dispatch<SetStateAction<BuilderResearchSettings>>;
  setBuilderSystem: Dispatch<SetStateAction<BuilderSystemConfig>>;
  setSelectedTools: Dispatch<SetStateAction<string[]>>;
}) {
  useEffect(() => {
    const controller = new AbortController();
    async function loadConfig() {
      try {
        const nextConfig = await fetchBuilderConfig(apiBase, controller.signal);
        setConfig(nextConfig);
        setBuilderSystem(defaultBuilderSystem(nextConfig));
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
    setResearchBudget,
    setResearchSettings,
    setBuilderSystem,
    setSelectedTools,
  ]);
}

function defaultBuilderSystem(config: BuilderConfig): BuilderSystemConfig {
  const planner = {
    provider: config.defaults.promptProvider,
    model: config.defaults.promptModel,
  };
  return {
    modelSelections: {
      "builder.planner": planner,
      "builder.prompt_composer": planner,
      "builder.database_planner": planner,
      "builder.tool_planner": planner,
      "builder.researcher": {
        provider: config.defaults.researchProvider,
        model: config.defaults.researchModel,
      },
      "builder.verifier": {
        provider: config.defaults.knowledgeVerificationProvider,
        model: config.defaults.knowledgeVerificationModel,
      },
    },
  };
}
