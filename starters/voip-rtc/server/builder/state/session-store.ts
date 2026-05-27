import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { sessionStatePath } from "./paths.js";
import type { BuilderSessionState } from "../types.js";
import { asRecord, readString } from "../utils.js";

const builderSession = loadBuilderSession();

export function setActiveDraft(draftId: string): void {
  syncActiveDraft(draftId, new Date().toISOString());
}

export function activeDraftId(): string | undefined {
  return builderSession.activeDraftId;
}

export function sessionUpdatedAt(): string | undefined {
  return builderSession.updatedAt;
}

export function syncActiveDraft(draftId: string, updatedAt: string): void {
  builderSession.activeDraftId = draftId;
  builderSession.updatedAt = updatedAt;
  persistBuilderSession();
}

function loadBuilderSession(): BuilderSessionState {
  if (!existsSync(sessionStatePath)) return {};
  try {
    const raw = readFileSync(sessionStatePath, "utf8");
    const parsed = asRecord(JSON.parse(raw) as unknown);
    return {
      activeDraftId: readString(parsed, "activeDraftId") || undefined,
      updatedAt: readString(parsed, "updatedAt") || undefined,
    };
  } catch (error) {
    console.warn("Failed to load builder session state:", error);
    return {};
  }
}

function persistBuilderSession(): void {
  try {
    mkdirSync(dirname(sessionStatePath), { recursive: true });
    writeFileSync(sessionStatePath, JSON.stringify(builderSession, null, 2));
  } catch (error) {
    console.warn("Failed to persist builder session state:", error);
  }
}
