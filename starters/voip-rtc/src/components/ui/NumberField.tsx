import type { InputHTMLAttributes } from "react";

export function NumberField({
  label,
  onValueChange,
  ...inputProps
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "type"> & {
  label: string;
  onValueChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        {...inputProps}
        type="number"
        onChange={(event) => onValueChange(Number(event.target.value))}
      />
    </label>
  );
}
