import type { HTMLAttributes, ReactNode } from "react";

export type BadgeVariant =
  | "success"
  | "info"
  | "warning"
  | "danger"
  | "neutral";

export type BadgeSize = "sm" | "md";

export function Badge({
  children,
  variant = "neutral",
  size = "sm",
  className = "",
  dot,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Show a leading status dot */
  dot?: boolean;
}) {
  const classes = [
    "studioBadge",
    `studioBadge--${variant}`,
    size === "md" ? "studioBadge--md" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...props}>
      {dot && <span className="studioBadge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
