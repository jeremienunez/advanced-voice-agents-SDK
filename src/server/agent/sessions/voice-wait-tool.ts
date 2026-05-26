export const WAIT_FOR_USER_TOOL_NAME = "wait_for_user";

export const WAIT_FOR_USER_TOOL = {
  type: "function" as const,
  name: WAIT_FOR_USER_TOOL_NAME,
  description:
    "Call this when the latest audio does not need a spoken response, such as silence, background noise, hold music, store announcements, side conversation, or speech not addressed to the assistant. This tool ends the turn without speaking.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
};

export function isWaitForUserTool(name: string): boolean {
  return name === WAIT_FOR_USER_TOOL_NAME;
}
