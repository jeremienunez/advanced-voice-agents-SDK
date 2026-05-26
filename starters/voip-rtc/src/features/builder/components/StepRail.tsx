import "./StepRail.css";
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
  const progressPercent = (unlocked / (BUILDER_STEPS.length - 1)) * 100;

  return (
    <div className="wizard-rail" aria-label="Builder progress">
      <div
        className="wizard-rail-progress"
        style={{ width: `${progressPercent}%` }}
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
