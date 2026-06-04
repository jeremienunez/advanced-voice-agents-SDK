import { useCallback, useEffect, useState } from "react";
import { DEFAULT_BUILDER_URL } from "./api/constants.js";
import { StudioShell } from "./components/layout/StudioShell.js";
import { defaultAppMode, type AppMode } from "./domain/app-mode.js";
import type {
  AgentBuildDraft,
  CompiledAgentSummary,
} from "./domain/builder.js";
import { AgentBank } from "./features/agent-bank/AgentBank.js";
import { BuilderLab } from "./features/builder/BuilderLab.js";
import { CommandCenter } from "./features/command-center/CommandCenter.js";
import { OnboardingConfig } from "./features/onboarding/OnboardingConfig.js";
import { RtcLab } from "./features/rtc/RtcLab.js";
import { useBuilderSessionRestore } from "./hooks/useBuilderSessionRestore.js";

export function App() {
  const [studioMode, setStudioMode] = useState<"ui" | "ide">(() => {
    return (localStorage.getItem("studio_mode") as "ui" | "ide") ?? "ide";
  });
  const [mode, setMode] = useState<AppMode>(() => {
    const params = new URLSearchParams(window.location.search);
    const initialMode = params.get("mode") as AppMode;
    const allowed: AppMode[] = ["command", "builder", "agents", "rtc", "environment"];
    if (initialMode && allowed.includes(initialMode)) {
      return initialMode;
    }
    return defaultAppMode;
  });
  const [compiledAgent, setCompiledAgent] =
    useState<CompiledAgentSummary | null>(null);
  const [restoredDraft, setRestoredDraft] = useState<AgentBuildDraft | null>(
    null,
  );
  const [agentBankRefreshKey, setAgentBankRefreshKey] = useState(0);

  const handleStudioModeChange = useCallback((next: "ui" | "ide") => {
    setStudioMode(next);
    localStorage.setItem("studio_mode", next);
    if (next === "ui") {
      setMode((current) => {
        if (current === "command" || current === "rtc") return current;
        return "command";
      });
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") !== mode) {
      params.set("mode", mode);
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    }
  }, [mode]);

  const builderApiBase =
    import.meta.env.VITE_BUILDER_API_URL ?? DEFAULT_BUILDER_URL;
  const activeAgentLabel =
    compiledAgent?.publicAgentName ?? compiledAgent?.draftId;

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
    <div className="appFrame">
      <StudioShell
        mode={mode}
        onModeChange={setMode}
        studioMode={studioMode}
        onStudioModeChange={handleStudioModeChange}
        health={{
          tone: compiledAgent ? "ready" : "idle",
          label: compiledAgent ? "Agent loaded" : "Studio ready",
          detail: activeAgentLabel ?? "No active RTC agent",
        }}
      >
        {mode === "command" ? (
          <CommandCenter
            apiBase={builderApiBase}
            refreshKey={agentBankRefreshKey}
            onCreateAgent={() => setMode("builder")}
            onLoadRtc={loadRtcAgent}
            onOperateAgents={() => setMode("agents")}
            onOpenEnvironment={() => setMode("environment")}
            onResumeBuilder={(draft) => {
              setRestoredDraft(draft);
              setMode("builder");
            }}
          />
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
        ) : mode === "rtc" ? (
          <RtcLab compiledAgent={compiledAgent} />
        ) : mode === "environment" ? (
          <OnboardingConfig apiBase={builderApiBase} />
        ) : (
          null
        )}
      </StudioShell>
    </div>
  );
}
