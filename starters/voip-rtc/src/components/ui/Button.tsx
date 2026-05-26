import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "default" | "primary" | "ghost";

export function Button({
  children,
  className = "",
  type = "button",
  variant = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
}) {
  const variantClass = variant === "default" ? "" : variant;
  const classes = [variantClass, className].filter(Boolean).join(" ");

  return (
    <button className={classes || undefined} type={type} {...props}>
      {children}
    </button>
  );
}
