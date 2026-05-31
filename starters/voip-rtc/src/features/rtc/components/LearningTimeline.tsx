import type { BrowserVoiceSessionSnapshot } from "@voiceagentsdk/core/client/browser";

const statusOrder = [
  "queued",
  "running",
  "evaluated",
  "applied",
  "pending_approval",
  "rejected",
  "failed",
  "skipped",
] as const;

export function LearningTimeline({
  learning,
}: {
  learning: BrowserVoiceSessionSnapshot["learning"];
}) {
  if (!learning) {
    return <p className="muted">Learning timeline appears after session end.</p>;
  }

  return (
    <div className="learningTimeline" aria-label="Learning timeline">
      <div className="learningTimelineSteps">
        {statusOrder.map((status) => {
          const active = learning.status === status;
          return (
            <span key={status} className={active ? "active" : ""}>
              {status}
            </span>
          );
        })}
      </div>
      <p>{learning.message ?? learning.runId}</p>
    </div>
  );
}
