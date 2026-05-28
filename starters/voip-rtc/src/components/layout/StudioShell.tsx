import type { ReactNode } from "react";
import type { AppMode } from "../../domain/app-mode.js";
import {
  studioNavItems,
  type StudioHealthSummary,
} from "../../domain/studio.js";

export function StudioShell({
  mode,
  health,
  children,
  onModeChange,
  studioMode,
  onStudioModeChange,
}: {
  mode: AppMode;
  health: StudioHealthSummary;
  children: ReactNode;
  onModeChange: (mode: AppMode) => void;
  studioMode: "ui" | "ide";
  onStudioModeChange: (next: "ui" | "ide") => void;
}) {
  const active = studioNavItems.find((item) => item.mode === mode);
  const filteredNavItems = studioNavItems.filter((item) => {
    if (studioMode === "ui") {
      return item.mode === "command" || item.mode === "rtc";
    }
    return true;
  });

  return (
    <div className="studioShell">
      <aside className="studioSidebar" aria-label="Studio navigation">
        <div className="studioMark" aria-hidden="true">VA</div>
        <nav className="studioNav">
          {filteredNavItems.map((item) => (
            <button
              aria-current={item.mode === mode ? "page" : undefined}
              className={item.mode === mode ? "studioNavItem active" : "studioNavItem"}
              key={item.mode}
              type="button"
              onClick={() => onModeChange(item.mode)}
              title={item.label}
            >
              <span>{item.shortLabel}</span>
            </button>
          ))}
        </nav>

        <div className="studioModeSelectorContainer">
          <div className="studioModeLabel">View</div>
          <div className="studioModeSelector">
            <button
              className={`modeSelBtn ${studioMode === "ui" ? "active" : ""}`}
              onClick={() => onStudioModeChange("ui")}
              title="Basculez en mode utilisateur simplifié"
              type="button"
            >
              UI
            </button>
            <button
              className={`modeSelBtn ${studioMode === "ide" ? "active" : ""}`}
              onClick={() => onStudioModeChange("ide")}
              title="Basculez en mode développement complet"
              type="button"
            >
              IDE
            </button>
          </div>
        </div>
      </aside>

      <section className="studioMain">
        <header className="studioTopbar">
          <div className="studioTitleBlock">
            <p className="studioEyebrow">Voice Agent Studio</p>
            <h1>{active?.label ?? "Command Center"}</h1>
          </div>
          <label className="studioCommand">
            <span className="srOnly">Search or run a command</span>
            <input
              aria-readonly="true"
              placeholder="Search agents, run RTC, open Environment"
              readOnly
            />
          </label>
          <div className={`studioHealth ${health.tone}`}>
            <strong>{health.label}</strong>
            <span>{health.detail}</span>
          </div>
        </header>

        <main className="studioContent" id={`panel-${mode}`}>
          {children}
        </main>
      </section>
    </div>
  );
}
