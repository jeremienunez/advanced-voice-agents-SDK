import type { SelectHTMLAttributes } from "react";

export interface SelectOption {
  disabled?: boolean;
  label: string;
  value: string;
}

export function SelectField({
  label,
  options,
  onValueChange,
  ...selectProps
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & {
  label: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        {...selectProps}
        onChange={(event) => onValueChange(event.target.value)}
      >
        {options.map((option) => (
          <option
            key={option.value}
            disabled={option.disabled}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
