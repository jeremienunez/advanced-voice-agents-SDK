import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button.js";
import { Metric } from "../../components/ui/Metric.js";
import { Panel } from "../../components/ui/Panel.js";
import type {
  AgentBuildDraft,
  CompiledAgentSummary,
} from "../../domain/builder/types.js";
import { useAgentBank } from "../../hooks/useAgentBank.js";
import { AgentDetailPanel } from "./AgentDetailPanel.js";
import { AgentCard } from "./AgentCard.js";
import {
  defaultSelectedAgent,
  filterAgents,
  type AgentStatusFilter,
} from "./agent-bank-view-model.js";
import "./styles/AgentBank.css";

export function AgentBank({
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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AgentStatusFilter>("all");
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"carousel" | "grid">("carousel");

  const bank = useAgentBank({
    apiBase,
    refreshKey,
    onLoadRtc,
    onResumeBuilder,
  });

  const visibleAgents = useMemo(
    () => filterAgents(bank.agents, query, filter),
    [bank.agents, filter, query],
  );
  const selectedAgent =
    visibleAgents.find((agent) => agent.draftId === selectedDraftId) ??
    defaultSelectedAgent(visibleAgents);
  const bankBusy = Boolean(bank.busyDraftId);

  /* Selection is the single source of truth; the carousel index derives
     from it. Two state copies synced by effects used to oscillate forever
     whenever a filter change reordered the visible list. */
  const activeIndex = selectedAgent
    ? Math.max(
        0,
        visibleAgents.findIndex((a) => a.draftId === selectedAgent.draftId),
      )
    : 0;

  useEffect(() => {
    if (!selectedDraftId && selectedAgent) {
      setSelectedDraftId(selectedAgent.draftId);
    }
  }, [selectedDraftId, selectedAgent]);

  const handlePrev = () => {
    if (visibleAgents.length === 0) return;
    const next = (activeIndex - 1 + visibleAgents.length) % visibleAgents.length;
    setSelectedDraftId(visibleAgents[next].draftId);
  };

  const handleNext = () => {
    if (visibleAgents.length === 0) return;
    const next = (activeIndex + 1) % visibleAgents.length;
    setSelectedDraftId(visibleAgents[next].draftId);
  };

  return (
    <section className="agentsPage fade-in">
      <header className="agentsHeader">
        <div>
          <p className="studioEyebrow">Agents</p>
          <h1>Agent library</h1>
          <p className="muted">
            Scan, run, resume, and manage compiled agents and drafts.
          </p>
        </div>
        <div className="bankStats">
          <Metric label="Compiled" value={String(bank.compiledCount)} />
          <Metric label="Drafts" value={String(bank.draftCount)} />
        </div>
      </header>

      <section className="agentsToolbar">
        <label>
          <span>Search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, intent, or draft ID"
          />
        </label>
        <label>
          <span>Filter</span>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as AgentStatusFilter)}
          >
            <option value="all">All agents</option>
            <option value="compiled">Compiled</option>
            <option value="draft">Drafts</option>
            <option value="ready">Ready for RTC</option>
            <option value="warning">Needs attention</option>
          </select>
        </label>
        <div className="layoutToggleWrapper">
          <span className="toggleLabel">Layout</span>
          <div className="layoutToggle">
            <button
              type="button"
              className={`toggleBtn ${viewMode === "carousel" ? "active" : ""}`}
              onClick={() => setViewMode("carousel")}
              title="Carousel 3D"
            >
              carousel
            </button>
            <button
              type="button"
              className={`toggleBtn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
              title="Grid Layout"
            >
              grid
            </button>
          </div>
        </div>
        <Button
          disabled={bank.loading}
          variant="primary"
          onClick={() => void bank.loadAgents()}
        >
          {bank.loading ? "Refreshing..." : "Refresh"}
        </Button>
      </section>

      {bank.message ? <p className="error">{bank.message}</p> : null}

      <div className="agentsLayout">
        <section className={viewMode === "carousel" ? "agentCarouselSection" : "agentCards"} aria-busy={bank.loading}>
          {bank.loading ? (
            <Panel title="Loading agents">
              <p className="muted">Reading the local SDK state...</p>
            </Panel>
          ) : bank.agents.length === 0 ? (
            <Panel title="No agents found">
              <p className="muted">
                Compile an agent or save a draft to start filling the library.
              </p>
            </Panel>
          ) : visibleAgents.length === 0 ? (
            <Panel title="No agents found">
              <p className="muted">Adjust search or filter criteria to show agents.</p>
            </Panel>
          ) : viewMode === "grid" ? (
            visibleAgents.map((agent) => (
              <AgentCard
                key={agent.draftId}
                agent={agent}
                active={selectedAgent?.draftId === agent.draftId}
                busy={bankBusy}
                busyDraftId={bank.busyDraftId}
                onSelect={setSelectedDraftId}
                onLoadRtc={bank.loadInRtc}
                onResumeBuilder={bank.resumeDraft}
                onRollback={bank.rollbackAgent}
              />
            ))
          ) : (
            <div className="agentCarouselWrapper">
              <div className="agentCarouselViewport">
                <div className="agentCarouselTrack">
                  {visibleAgents.map((agent, index) => {
                    let slideClass = "agentCarouselSlide hidden";
                    if (index === activeIndex) {
                      slideClass = "agentCarouselSlide active";
                    } else if (index === activeIndex - 1) {
                      slideClass = "agentCarouselSlide prev";
                    } else if (index === activeIndex + 1) {
                      slideClass = "agentCarouselSlide next";
                    } else if (index === activeIndex - 2) {
                      slideClass = "agentCarouselSlide far-prev";
                    } else if (index === activeIndex + 2) {
                      slideClass = "agentCarouselSlide far-next";
                    } else if (index < activeIndex) {
                      slideClass = "agentCarouselSlide far-prev hidden";
                    } else if (index > activeIndex) {
                      slideClass = "agentCarouselSlide far-next hidden";
                    }

                    return (
                      <div
                        key={agent.draftId}
                        className={slideClass}
                        onClick={() => setSelectedDraftId(agent.draftId)}
                      >
                        <AgentCard
                          agent={agent}
                          active={selectedAgent?.draftId === agent.draftId}
                          busy={bankBusy}
                          busyDraftId={bank.busyDraftId}
                          onSelect={setSelectedDraftId}
                          onLoadRtc={bank.loadInRtc}
                          onResumeBuilder={bank.resumeDraft}
                          onRollback={bank.rollbackAgent}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {visibleAgents.length > 1 && (
                <div className="carouselControls">
                  <button
                    type="button"
                    className="carouselNavBtn"
                    onClick={handlePrev}
                    aria-label="Previous agent"
                  >
                    ←
                  </button>
                  <div className="carouselCounter">
                    <span className="current">{activeIndex + 1}</span>
                    <span className="separator">/</span>
                    <span className="total">{visibleAgents.length}</span>
                  </div>
                  <button
                    type="button"
                    className="carouselNavBtn"
                    onClick={handleNext}
                    aria-label="Next agent"
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
        <AgentDetailPanel
          agent={selectedAgent}
          busy={bankBusy}
          onLoadRtc={bank.loadInRtc}
          onResumeBuilder={bank.resumeDraft}
          onRollback={bank.rollbackAgent}
        />
      </div>
    </section>
  );
}
