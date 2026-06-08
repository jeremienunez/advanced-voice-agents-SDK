import type { AgentBuildDraft } from "@voiceagentsdk/core/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { isAgentDraft } from "../domain/drafts/mutations.js";
import { draftStatePath } from "./paths.js";
import { readString } from "../utils/record-readers.js";

const drafts = loadDrafts();

export function requireDraft(draftId: string): AgentBuildDraft {
  const draft = drafts.get(draftId);
  if (!draft) throw new Error(`Unknown builder draft "${draftId}"`);
  return draft;
}

export function getDraft(draftId: string): AgentBuildDraft | undefined {
  return drafts.get(draftId);
}

export function resolveDraft(body: unknown): AgentBuildDraft {
  const draftId = readString(body, "draftId");
  const existing = drafts.get(draftId);
  if (existing) return existing;
  if (!draftId) throw new Error("draftId is required");
  return requireDraft(draftId);
}

export function saveDraft(draft: AgentBuildDraft): void {
  drafts.set(draft.id, draft);
  persistDrafts();
}

export function draftValues(): AgentBuildDraft[] {
  return Array.from(drafts.values());
}

function loadDrafts(): Map<string, AgentBuildDraft> {
  if (!existsSync(draftStatePath)) return new Map();
  try {
    const raw = readFileSync(draftStatePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Map();
    return new Map(
      parsed
        .filter(isAgentDraft)
        .map((draft): [string, AgentBuildDraft] => [draft.id, draft]),
    );
  } catch (error) {
    console.warn("Failed to load builder draft state:", error);
    return new Map();
  }
}

function persistDrafts(): void {
  try {
    mkdirSync(dirname(draftStatePath), { recursive: true });
    writeFileSync(
      draftStatePath,
      JSON.stringify(Array.from(drafts.values()), null, 2),
    );
  } catch (error) {
    console.warn("Failed to persist builder draft state:", error);
  }
}
