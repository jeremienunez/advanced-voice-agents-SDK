import type { CSSProperties, HTMLAttributes } from "react";

export type SkeletonVariant = "text" | "circle" | "rect";

export function Skeleton({
  variant = "text",
  width,
  height,
  lines = 1,
  className = "",
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  /** Number of text lines to render (only for variant="text") */
  lines?: number;
}) {
  const baseStyle: CSSProperties = { ...style };
  if (width) baseStyle.width = typeof width === "number" ? `${width}px` : width;
  if (height)
    baseStyle.height = typeof height === "number" ? `${height}px` : height;

  if (variant === "text" && lines > 1) {
    return (
      <div
        className={`studioSkeleton__group ${className}`.trim()}
        role="status"
        aria-label="Loading"
        {...props}
      >
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={`studioSkeleton studioSkeleton--text ${i === lines - 1 ? "studioSkeleton--short" : ""}`}
          />
        ))}
        <span className="srOnly">Loading…</span>
      </div>
    );
  }

  const classes = [
    "studioSkeleton",
    `studioSkeleton--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      style={baseStyle}
      role="status"
      aria-label="Loading"
      {...props}
    >
      <span className="srOnly">Loading…</span>
    </div>
  );
}
