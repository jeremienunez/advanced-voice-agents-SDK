import "../styles/components/StepRail.css";
import { StepRailStep } from "./StepRailStep.js";

const BUILDER_STEPS = [
  "Identity",
  "Prompt",
  "Knowledge",
  "Database",
  "Tools",
  "Compile",
];

export function StepRail({
  active,
  unlocked,
  onStepClick,
}: {
  active: number;
  unlocked: number;
  onStepClick?: (step: number) => void;
}) {
  const clampedUnlocked = Math.min(
    Math.max(unlocked, 0),
    BUILDER_STEPS.length - 1,
  );
  const progressHeight = `calc((100% - 44px) * ${clampedUnlocked} / ${
    BUILDER_STEPS.length - 1
  })`;

  return (
    <div className="wizard-rail" aria-label="Builder progress">
      <div
        className="wizard-rail-progress"
        style={{ height: progressHeight }}
      />
      {BUILDER_STEPS.map((step, index) => (
        <StepRailStep
          key={step}
          index={index}
          label={step}
          status={getStepStatus(index, active, unlocked)}
          onSelect={onStepClick}
        />
      ))}
    </div>
  );
}

function getStepStatus(index: number, active: number, unlocked: number) {
  if (index === active) return "active";
  if (index < active) return "completed";
  if (index <= unlocked) return "available";
  return "locked";
}
