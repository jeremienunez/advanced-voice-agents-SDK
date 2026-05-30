import type { HTMLAttributes, ReactNode } from "react";

export type CardVariant = "elevated" | "flat" | "outlined";

export function Card({
  children,
  variant = "elevated",
  className = "",
  padding = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  variant?: CardVariant;
  /** Apply default padding (default: true) */
  padding?: boolean;
}) {
  const classes = [
    "studioCard",
    `studioCard--${variant}`,
    padding ? "" : "studioCard--flush",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
