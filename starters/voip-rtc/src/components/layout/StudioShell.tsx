import React, { type ReactNode, useCallback, useEffect, useState } from "react";
import type { AppMode } from "../../domain/app-mode.js";
import {
  studioNavItems,
  type StudioHealthSummary,
} from "../../domain/studio.js";

const iconsMap: Record<string, React.ReactNode> = {
  command: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="navIcon"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  ),
  builder: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="navIcon"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
  ),
  agents: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="navIcon"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
  rtc: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="navIcon"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
  ),
  environment: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="navIcon"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1-1 1.73l.43-.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73-.73l-.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
  ),
};

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

  // ─── Theme toggle (dark/light) ───
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    document.documentElement.classList.toggle("studio-dark", dark);
  }, [dark]);

  const toggleTheme = useCallback(() => setDark((d) => !d), []);

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
              <span className="navIconContainer">
                {iconsMap[item.mode]}
              </span>
              <span>{item.shortLabel}</span>
            </button>
          ))}
        </nav>

        <button
          className="studioThemeToggle"
          onClick={toggleTheme}
          title={dark ? "Passer en mode clair" : "Passer en mode sombre"}
          type="button"
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? "☀️" : "🌙"}
        </button>

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
