import type { InputHTMLAttributes } from "react";

export function TextField({
  label,
  onValueChange,
  ...inputProps
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  label: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        {...inputProps}
        onChange={(event) => onValueChange(event.target.value)}
      />
    </label>
  );
}
