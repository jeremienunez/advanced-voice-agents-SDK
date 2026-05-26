import { useCallback, useEffect, useState } from "react";
import {
  activateAgentSession,
  fetchAgents,
  fetchDraft,
} from "../api/builderApi.js";
import type {
  AgentBankItem,
  AgentBankResponse,
  AgentBuildDraft,
  CompiledAgentSummary,
} from "../domain/builder.js";

export function useAgentBank({
  apiBase,
  refreshKey,
  onLoadRtc,
  onResumeBuilder,
}: {
  apiBase: string;
  refreshKey: number;
  onLoadRtc: (artifact: CompiledAgentSummary) => void;
  onResumeBuilder: (draft: AgentBuildDraft) => void;
}) {
  const [bank, setBank] = useState<AgentBankResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyDraftId, setBusyDraftId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      setBank(await fetchAgents(apiBase));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Agent bank failed");
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents, refreshKey]);

  async function loadInRtc(agent: AgentBankItem) {
    setBusyDraftId(agent.draftId);
    setMessage(null);
    try {
      const session = await activateAgentSession(apiBase, agent.draftId);
      if (!session.artifact) throw new Error("Selected agent is not compiled");
      onLoadRtc(session.artifact);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load agent");
    } finally {
      setBusyDraftId(null);
    }
  }

  async function resumeDraft(agent: AgentBankItem) {
    setBusyDraftId(agent.draftId);
    setMessage(null);
    try {
      const payload = await fetchDraft(apiBase, agent.draftId);
      onResumeBuilder(payload.draft);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not resume draft");
    } finally {
      setBusyDraftId(null);
    }
  }

  const agents = bank?.agents ?? [];
  const compiledCount = agents.filter((agent) => agent.kind === "compiled").length;

  return {
    bank,
    loading,
    busyDraftId,
    message,
    agents,
    compiledCount,
    draftCount: agents.length - compiledCount,
    loadAgents,
    loadInRtc,
    resumeDraft,
  };
}
