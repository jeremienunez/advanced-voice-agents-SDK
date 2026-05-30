import type { ReactNode } from "react";

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`studioCard__body ${className}`.trim()}>{children}</div>
  );
}
