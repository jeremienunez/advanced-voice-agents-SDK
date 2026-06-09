export type LearningRunStatus =
  | "queued"
  | "running"
  | "evaluated"
  | "applied"
  | "pending_approval"
  | "rejected"
  | "failed"
  | "skipped";

export type LearningLoopProfile =
  | "observe"
  | "memory_only"
  | "memory_and_candidates"
  | "auto_apply_prompt_safe"
  | "approval_required";
