import type { VoiceSessionTool } from "@voiceagentsdk/core/server";
import { runtimeAgentFromDraft } from "../runtime/compiled-agent.js";
import { runtimeKnowledgeTools } from "../runtime/knowledge-tools.js";
import { runtimeActionTools } from "../runtime/tools/action-tools.js";
import type { BuilderService, RuntimeKnowledge } from "./types.js";

export function toolsForRequest(
  agentId: string | undefined,
  options: {
    builderService: BuilderService;
    runtimeKnowledge?: RuntimeKnowledge;
  },
): VoiceSessionTool[] {
  const agent = runtimeAgentFromDraft(options.builderService.getCompiledDraft(agentId));
  const knowledge = options.runtimeKnowledge
    ? runtimeKnowledgeTools(agentId, {
        ...options.runtimeKnowledge,
        getAgent: () => agent,
      })
    : [];
  const actions = agent ? runtimeActionTools(agent) : [];
  return [...knowledge, ...actions];
}
