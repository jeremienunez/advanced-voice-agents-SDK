export function StepRailStep({
  index,
  label,
  status,
  onSelect,
}: {
  index: number;
  label: string;
  status: "active" | "completed" | "available" | "locked";
  onSelect?: (step: number) => void;
}) {
  const isCompleted = status === "completed";
  const isLocked = status === "locked";

  return (
    <button
      aria-current={status === "active" ? "step" : undefined}
      className={`wizard-node ${status}`}
      disabled={isLocked || !onSelect}
      type="button"
      onClick={() => onSelect?.(index)}
    >
      <span className="wizard-circle">{isCompleted ? "✓" : index + 1}</span>
      <span className="wizard-label">{label}</span>
    </button>
  );
}
