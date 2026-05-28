import type { AppMode } from "./app-mode.js";

export type StudioHealthTone = "ready" | "warning" | "error" | "idle";

export interface StudioNavItem {
  mode: AppMode;
  label: string;
  shortLabel: string;
  description: string;
}

export interface StudioHealthSummary {
  tone: StudioHealthTone;
  label: string;
  detail: string;
}

export const studioNavItems: StudioNavItem[] = [
  {
    mode: "command",
    label: "Command Center",
    shortLabel: "Home",
    description: "Overview, active agent, and primary actions",
  },
  {
    mode: "builder",
    label: "Builder",
    shortLabel: "Build",
    description: "Create or resume a guided agent build",
  },
  {
    mode: "agents",
    label: "Agents",
    shortLabel: "Agents",
    description: "Manage compiled agents and drafts",
  },
  {
    mode: "rtc",
    label: "RTC",
    shortLabel: "RTC",
    description: "Run a realtime voice test",
  },
  {
    mode: "environment",
    label: "Environment",
    shortLabel: "Env",
    description: "Configure providers, database, infra, and auth",
  },
];
