import type { AppMode } from "../../domain/app-mode.js";

export function ModeTabButton({
  active,
  controls,
  label,
  mode,
  onSelect,
}: {
  active: boolean;
  controls: string;
  label: string;
  mode: AppMode;
  onSelect: (mode: AppMode) => void;
}) {
  return (
    <button
      aria-controls={controls}
      aria-selected={active}
      className={active ? "active" : ""}
      id={`tab-${mode}`}
      role="tab"
      type="button"
      onClick={() => onSelect(mode)}
    >
      {label}
    </button>
  );
}
