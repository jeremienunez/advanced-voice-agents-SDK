import { type ReactNode, useCallback, useRef, useState } from "react";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export function Tooltip({
  children,
  content,
  placement = "top",
  delay = 200,
  className = "",
}: {
  children: ReactNode;
  content: ReactNode;
  placement?: TooltipPlacement;
  /** Delay in ms before showing tooltip */
  delay?: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  return (
    <span
      className={`studioTooltip__anchor ${className}`.trim()}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          className={`studioTooltip studioTooltip--${placement}`}
          role="tooltip"
        >
          <span className="studioTooltip__content">{content}</span>
          <span className="studioTooltip__arrow" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}
