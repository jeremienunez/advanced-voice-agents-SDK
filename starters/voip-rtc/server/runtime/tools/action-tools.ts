import type { ToolDefinition } from "@voiceagentsdk/core/sdk";
import type { VoiceSessionTool } from "@voiceagentsdk/core/server";
import type { RuntimeCompiledAgent } from "../compiled-agent.js";

type ActionHandler = (
  args: Record<string, unknown>,
  tool: ToolDefinition,
) => Promise<Record<string, unknown>>;

const handlers: Record<string, ActionHandler> = {
  "summary.create": async (args) => ({
    status: "created",
    summary: readString(args.summary),
    keyFacts: readStringArray(args.keyFacts),
    nextActions: readStringArray(args.nextActions),
  }),
  "handoff.create": async (args) => confirmed(args, {
    status: "handoff_requested",
    reason: readString(args.reason),
    urgency: readString(args.urgency) || "normal",
  }),
  "task.schedule": async (args) => confirmed(args, {
    status: "follow_up_scheduled",
    topic: readString(args.topic),
    dueAt: readString(args.dueAt),
  }),
  "event.emit": async (args) => confirmed(args, {
    status: "note_emitted",
    eventType: readString(args.eventType),
    payload: readRecord(args.payload),
  }),
};

export function runtimeActionTools(agent: RuntimeCompiledAgent): VoiceSessionTool[] {
  const selectedTools = new Set(agent.selectedTools);

  return agent.artifact.sdkDefinition.tools
    .filter((tool) => selectedTools.has(tool.name))
    .filter((tool) => tool.handlerRef && handlers[tool.handlerRef])
    .map(toRuntimeTool);
}

function toRuntimeTool(tool: ToolDefinition): VoiceSessionTool {
  const handler = handlers[tool.handlerRef as string];
  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    execute: (args) => handler(args, tool),
  };
}

async function confirmed(
  args: Record<string, unknown>,
  output: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (args.confirmed !== true) {
    return {
      status: "blocked",
      reason: "explicit user confirmation is required before this action",
    };
  }
  return output;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
