import type { BrowserVoiceServiceConfig } from "@voiceagentsdk/core/server/browser";
import type {
  LearningJobStatus,
  LearningSessionInput,
} from "@voiceagentsdk/core/sdk";
import { compactMetadata } from "./metadata.js";
import type { StarterVoiceServiceOptions } from "./types.js";

export function createSessionEndedLearningHook(
  options: StarterVoiceServiceOptions,
): NonNullable<BrowserVoiceServiceConfig["onSessionEnded"]> {
  return (input, emitStatus) => {
    if (!options.learning) {
      emitStatus(skippedLearningStatus(
        input.summary.sessionId,
        "Learning service is not configured.",
      ));
      return;
    }
    const draft = options.builderService.getCompiledDraft(input.request.agent);
    const draftId = input.request.agent ?? draft?.id;
    if (!draftId) {
      emitStatus(skippedLearningStatus(
        input.summary.sessionId,
        "No compiled draft was attached to the session.",
      ));
      return;
    }
    options.learning.enqueueSessionLearning(
      {
        agentId: draftId,
        draftId,
        tenantId: input.summary.tenantId,
        userId: input.summary.userId,
        summary: input.summary,
        transcript: input.transcript,
        toolCalls: input.toolCalls,
        metadata: compactMetadata({
          conversationId: input.request.conversationId,
          provider: input.request.provider,
          model: input.request.model,
          voice: input.request.voice,
        }),
      } satisfies LearningSessionInput,
      emitStatus,
    );
  };
}

function skippedLearningStatus(
  sessionId: string,
  message: string,
): LearningJobStatus {
  const now = new Date().toISOString();
  return {
    jobId: `job_${sessionId}`,
    runId: `learn_${sessionId}`,
    status: "skipped",
    queuedAt: now,
    finishedAt: now,
    message,
  };
}
