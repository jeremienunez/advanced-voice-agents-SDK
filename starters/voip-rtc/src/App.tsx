import { useCallback, useState } from "react";
import { DEFAULT_BUILDER_URL } from "./api/constants.js";
import { Atmosphere } from "./Atmosphere.js";
import { AppModeTabs } from "./components/navigation/AppModeTabs.js";
import type {
  AgentBuildDraft,
  AppMode,
  CompiledAgentSummary,
} from "./domain/builder.js";
import { AgentBank } from "./features/agent-bank/AgentBank.js";
import { BuilderLab } from "./features/builder/BuilderLab.js";
import { OnboardingConfig } from "./features/onboarding/OnboardingConfig.js";
import { RtcLab } from "./features/rtc/RtcLab.js";
import { SelectSpace } from "./features/hub/SelectSpace.js";
import { useBuilderSessionRestore } from "./hooks/useBuilderSessionRestore.js";

export function App() {
  const [mode, setMode] = useState<AppMode>("onboarding");
  const [compiledAgent, setCompiledAgent] =
    useState<CompiledAgentSummary | null>(null);
  const [restoredDraft, setRestoredDraft] = useState<AgentBuildDraft | null>(
    null,
  );
  const [agentBankRefreshKey, setAgentBankRefreshKey] = useState(0);
  const builderApiBase =
    import.meta.env.VITE_BUILDER_API_URL ?? DEFAULT_BUILDER_URL;

  const loadRtcAgent = useCallback((artifact: CompiledAgentSummary) => {
    setCompiledAgent(artifact);
    setMode("rtc");
  }, []);

  const restoreCompiledAgent = useCallback((artifact: CompiledAgentSummary) => {
    setCompiledAgent(artifact);
  }, []);

  const handleCompiled = useCallback(
    (artifact: CompiledAgentSummary) => {
      setAgentBankRefreshKey((current) => current + 1);
      loadRtcAgent(artifact);
    },
    [loadRtcAgent],
  );

  useBuilderSessionRestore({
    apiBase: builderApiBase,
    onCompiled: restoreCompiledAgent,
  });

  return (
    <main className="appFrame">
      <Atmosphere mode={mode} />
      {mode === "hub" ? (
        <SelectSpace
          apiBase={builderApiBase}
          onEnterMode={setMode}
          onLoadRtc={loadRtcAgent}
          onResumeBuilder={(draft) => {
            setRestoredDraft(draft);
            setMode("builder");
          }}
        />
      ) : (
        <div className="shell">
          <AppModeTabs mode={mode} onModeChange={setMode} />
          <section
            aria-labelledby={`tab-${mode}`}
            id={`panel-${mode}`}
            role="tabpanel"
          >
            {mode === "onboarding" ? (
              <OnboardingConfig apiBase={builderApiBase} />
            ) : mode === "builder" ? (
              <BuilderLab
                apiBase={builderApiBase}
                restoredDraft={restoredDraft}
                onRestoredDraftConsumed={() => setRestoredDraft(null)}
                onCompiled={handleCompiled}
              />
            ) : mode === "agents" ? (
              <AgentBank
                apiBase={builderApiBase}
                refreshKey={agentBankRefreshKey}
                onLoadRtc={loadRtcAgent}
                onResumeBuilder={(draft) => {
                  setRestoredDraft(draft);
                  setMode("builder");
                }}
              />
            ) : (
              <RtcLab compiledAgent={compiledAgent} />
            )}
          </section>
        </div>
      )}
    </main>
  );
}
