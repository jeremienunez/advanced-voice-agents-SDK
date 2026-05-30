import type { ReactNode } from "react";

export function CardHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`studioCard__header ${className}`.trim()}>{children}</div>
  );
}
