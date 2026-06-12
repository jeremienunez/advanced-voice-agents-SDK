/* The set_affect side-channel: a server-DEFINED tool the model calls to
   drive the hologram's facial expression. The core voice session
   intercepts it (sideChannel:"affect") before the pending-tool flow —
   execute() never runs. */

import type { VoiceSessionTool } from "@voiceagentsdk/core/server";

export function affectSideChannelTool(): VoiceSessionTool {
  return {
    type: "function",
    name: "set_affect",
    description:
      "Update your avatar's facial expression. Call it silently whenever your emotional tone shifts — do not mention it or wait for its result.",
    parameters: {
      type: "object",
      properties: {
        label: {
          type: "string",
          enum: ["neutral", "smile", "concern", "surprise", "thinking"],
          description: "The expression matching what you are about to say.",
        },
        intensity: {
          type: "number",
          description: "How strongly to express it, 0 to 1. Default to 0.6.",
        },
      },
      required: ["label"],
    },
    sideChannel: "affect",
    execute: async () => ({ ok: true }),
  };
}
