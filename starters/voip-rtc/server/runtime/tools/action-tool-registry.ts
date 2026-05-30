import type {
  ToolRegistryAdapterPort,
  ToolRegistryExecutionInput,
} from "@voiceagentsdk/core/sdk";

type ActionToolHandler = (
  input: ToolRegistryExecutionInput,
) => Promise<Record<string, unknown>>;

const actionHandlers: Record<string, ActionToolHandler> = {
  "summary.create": async ({ args }) => ({
    status: "created",
    summary: readString(args.summary),
    keyFacts: readStringArray(args.keyFacts),
    nextActions: readStringArray(args.nextActions),
  }),
  "handoff.create": async ({ args }) => ({
    status: "handoff_requested",
    reason: readString(args.reason),
    urgency: readString(args.urgency) || "normal",
  }),
  "task.schedule": async ({ args }) => ({
    status: "follow_up_scheduled",
    topic: readString(args.topic),
    dueAt: readString(args.dueAt),
  }),
  "event.emit": async ({ args }) => ({
    status: "note_emitted",
    eventType: readString(args.eventType),
    payload: readRecord(args.payload),
  }),
};

export const actionToolRegistryAdapter: ToolRegistryAdapterPort = {
  availableHandlerRefs: () => Object.keys(actionHandlers),
  canExecute: (tool) => {
    return Boolean(tool.handlerRef && actionHandlers[tool.handlerRef]);
  },
  execute: async (input) => {
    const handlerRef = input.tool.handlerRef;
    const handler = handlerRef ? actionHandlers[handlerRef] : undefined;
    if (!handler) {
      throw new Error(`No runtime tool handler for ${handlerRef ?? input.tool.name}`);
    }
    return handler(input);
  },
};

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
