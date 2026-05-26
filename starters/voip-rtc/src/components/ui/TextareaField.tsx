import type { TextareaHTMLAttributes } from "react";

export function TextareaField({
  label,
  onValueChange,
  ...textareaProps
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> & {
  label: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        {...textareaProps}
        onChange={(event) => onValueChange(event.target.value)}
      />
    </label>
  );
}
