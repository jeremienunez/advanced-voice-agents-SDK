import type { AppMode } from "../../domain/app/mode.js";
import { ModeTabButton } from "./ModeTabButton.js";

const APP_TABS: Array<{ label: string; mode: AppMode }> = [
  { label: "Command Center", mode: "command" },
  { label: "Builder", mode: "builder" },
  { label: "Agent Bank", mode: "agents" },
  { label: "RTC Lab", mode: "rtc" },
  { label: "Environment", mode: "environment" },
];

export function AppModeTabs({
  mode,
  onModeChange,
}: {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
}) {
  return (
    <nav className="modeTabs" aria-label="Starter sections" role="tablist">
      {APP_TABS.map((tab) => (
        <ModeTabButton
          key={tab.mode}
          active={mode === tab.mode}
          controls={`panel-${tab.mode}`}
          label={tab.label}
          mode={tab.mode}
          onSelect={onModeChange}
        />
      ))}
    </nav>
  );
}
