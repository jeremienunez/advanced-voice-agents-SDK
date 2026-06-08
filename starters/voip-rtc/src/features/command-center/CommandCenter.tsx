import { useMemo } from "react";
import { Button } from "../../components/ui/Button.js";
import type {
  AgentBuildDraft,
  CompiledAgentSummary,
} from "../../domain/builder/types.js";
import { useAgentBank } from "../../hooks/useAgentBank.js";
import { CommandActionCard } from "./CommandActionCard.js";
import { HealthRow } from "./HealthRow.js";
import {
  draftCandidate,
  formatDate,
  summarizeAgent,
} from "./command-center-summary.js";

export function CommandCenter({
  apiBase,
  refreshKey,
  onCreateAgent,
  onOperateAgents,
  onOpenEnvironment,
  onResumeBuilder,
  onLoadRtc,
}: {
  apiBase: string;
  refreshKey: number;
  onCreateAgent: () => void;
  onOperateAgents: () => void;
  onOpenEnvironment: () => void;
  onResumeBuilder: (draft: AgentBuildDraft) => void;
  onLoadRtc: (artifact: CompiledAgentSummary) => void;
}) {
  const bank = useAgentBank({
    apiBase,
    refreshKey,
    onLoadRtc,
    onResumeBuilder,
  });
  const activeAgent =
    bank.agents.find((agent) => agent.active) ?? bank.agents[0] ?? null;
  const voiceAgent =
    bank.agents.find((agent) => agent.active && agent.canRunRtc) ??
    bank.agents.find((agent) => agent.canRunRtc) ??
    null;
  const recentAgents = useMemo(() => bank.agents.slice(0, 4), [bank.agents]);
  const agentSummary = useMemo(
    () => summarizeAgent(activeAgent),
    [activeAgent],
  );
  const draftAgent = useMemo(() => draftCandidate(bank.agents), [bank.agents]);
  const bankBusy = bank.loading || Boolean(bank.busyDraftId);

  return (
    <section className="commandCenter" aria-busy={bank.loading}>
      <div className="commandHero">
        <div className="commandHeroCopy">
          <p className="commandKicker">Command Center</p>
          <h2>Run, build, and operate your voice agents from one place.</h2>
          <p>
            Start a live voice test, continue a draft, or review the agent fleet
            without leaving the studio context.
          </p>
        </div>
        <div className="commandHeroStats" aria-label="Agent bank summary">
          <span>
            <strong>{bank.compiledCount}</strong>
            Compiled
          </span>
          <span>
            <strong>{bank.draftCount}</strong>
            Drafts
          </span>
          <span>
            <strong>{activeAgent ? "Ready" : "Empty"}</strong>
            Active state
          </span>
        </div>
      </div>

      {bank.message ? (
        <p className="commandMessage error" role="status">
          {bank.message}
        </p>
      ) : null}

      <div className="commandLayout">
        <div className="commandMain">
          <div className="commandActions">
            <CommandActionCard
              eyebrow="Realtime"
              title="Test Voice"
              description={
                voiceAgent
                  ? `Load ${voiceAgent.publicAgentName} into RTC.`
                  : "Compile an agent before starting a voice test."
              }
              actionLabel={
                bank.busyDraftId === voiceAgent?.draftId
                  ? "Loading..."
                  : "Open Voice Test"
              }
              disabled={!voiceAgent || bankBusy}
              primary
              onClick={() => {
                if (voiceAgent && !bankBusy) void bank.loadInRtc(voiceAgent);
              }}
            />
            <CommandActionCard
              eyebrow="Builder"
              title="Create or Resume"
              description={
                draftAgent
                  ? `Continue ${draftAgent.publicAgentName}.`
                  : "Start a guided build for a new voice agent."
              }
              actionLabel={
                draftAgent && bank.busyDraftId === draftAgent.draftId
                  ? "Opening..."
                  : draftAgent
                    ? "Resume Draft"
                    : "Create Agent"
              }
              disabled={bankBusy}
              onClick={() => {
                if (bankBusy) return;
                if (draftAgent) {
                  void bank.resumeDraft(draftAgent);
                  return;
                }
                onCreateAgent();
              }}
            />
            <CommandActionCard
              eyebrow="Operations"
              title="Operate Agent"
              description="Review compiled agents, drafts, knowledge, tools, and versions."
              actionLabel="Open Agents"
              disabled={bank.loading}
              onClick={onOperateAgents}
            />
          </div>

          <section className="commandPanel">
            <div className="commandPanelHeader">
              <div>
                <p className="commandKicker">Recent work</p>
                <h3>Latest agent activity</h3>
              </div>
              <Button onClick={() => void bank.loadAgents()} disabled={bank.loading}>
                {bank.loading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>

            <div className="recentList">
              {bank.loading ? (
                <p className="commandEmpty">Loading agent bank...</p>
              ) : recentAgents.length === 0 ? (
                <p className="commandEmpty">
                  No agents yet. Create an agent to populate your workspace.
                </p>
              ) : (
                recentAgents.map((agent) => (
                  <article className="recentItem" key={agent.draftId}>
                    <div>
                      <span className={`commandBadge ${agent.kind}`}>
                        {agent.kind === "compiled" ? "Compiled" : "Draft"}
                      </span>
                      <h4>{agent.publicAgentName}</h4>
                      <p>{agent.intent || "No intent recorded."}</p>
                    </div>
                    <div className="recentMeta">
                      <span>{formatDate(agent.updatedAt)}</span>
                      <span>{agent.selectedTools.length} tools</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="commandSide">
          <section className="commandPanel voicePreview">
            <div className="previewOrb" aria-hidden="true">
              <span />
            </div>
            <p className="commandKicker">Voice preview</p>
            <h3>{agentSummary.name}</h3>
            <p>{agentSummary.intent}</p>
            <dl className="previewSummary">
              <div>
                <dt>Status</dt>
                <dd>{agentSummary.status}</dd>
              </div>
              <div>
                <dt>Knowledge</dt>
                <dd>{agentSummary.knowledge}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{agentSummary.updated}</dd>
              </div>
            </dl>
            <Button
              variant="primary"
              disabled={!voiceAgent || bankBusy}
              onClick={() => {
                if (voiceAgent && !bankBusy) void bank.loadInRtc(voiceAgent);
              }}
            >
              {voiceAgent ? "Run in RTC" : "No compiled agent"}
            </Button>
          </section>

          <section className="commandPanel">
            <div className="commandPanelHeader compact">
              <div>
                <p className="commandKicker">Environment</p>
                <h3>Health</h3>
              </div>
              <Button variant="ghost" onClick={onOpenEnvironment}>
                Open
              </Button>
            </div>
            <div className="healthRows">
              <HealthRow
                label="Builder API"
                value={apiBase}
                tone={bank.message ? "error" : "ready"}
              />
              <HealthRow
                label="Agent bank"
                value={
                  bank.loading
                    ? "Refreshing"
                    : `${bank.agents.length} workspace items`
                }
                tone={bank.message ? "error" : "ready"}
              />
              <HealthRow
                label="RTC"
                value={voiceAgent ? "Agent available" : "Waiting"}
                tone={voiceAgent ? "ready" : "idle"}
              />
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
