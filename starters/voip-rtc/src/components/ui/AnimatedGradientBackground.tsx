import { useEffect, useRef } from "react";

interface AnimatedGradientBackgroundProps {
  startingGap?: number;
  breathing?: boolean;
  gradientColors?: string[];
  gradientStops?: number[];
  animationSpeed?: number;
  breathingRange?: number;
  containerStyle?: React.CSSProperties;
  containerClassName?: string;
  topOffset?: number;
}

export function AnimatedGradientBackground({
  startingGap = 125,
  breathing = false,
  gradientColors = [
    "#ffffff",
    "#e8f0fe",
    "#dff7ea",
    "#fff7db",
    "#fde8f1",
    "#dfe8ff",
  ],
  gradientStops = [18, 42, 58, 72, 86, 100],
  animationSpeed = 0.035,
  breathingRange = 5,
  containerStyle,
  topOffset = 0,
  containerClassName = "",
}: AnimatedGradientBackgroundProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  if (gradientColors.length !== gradientStops.length) {
    throw new Error("Gradient colors and stops must have the same length.");
  }

  useEffect(() => {
    let animationFrame = 0;
    let width = startingGap;
    let directionWidth = 1;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const paintGradient = () => {
      const stops = gradientStops
        .map((stop, index) => `${gradientColors[index]} ${stop}%`)
        .join(", ");
      const height = width + topOffset;
      if (containerRef.current) {
        containerRef.current.style.background =
          `radial-gradient(${width}% ${height}% at 50% 20%, ${stops})`;
      }
    };

    const animateGradient = () => {
      if (width >= startingGap + breathingRange) directionWidth = -1;
      if (width <= startingGap - breathingRange) directionWidth = 1;
      width += breathing ? directionWidth * animationSpeed : 0;
      paintGradient();
      if (!reduceMotion.matches) {
        animationFrame = requestAnimationFrame(animateGradient);
      }
    };

    animateGradient();
    return () => cancelAnimationFrame(animationFrame);
  }, [
    animationSpeed,
    breathing,
    breathingRange,
    gradientColors,
    gradientStops,
    startingGap,
    topOffset,
  ]);

  return (
    <div
      aria-hidden="true"
      className={`animatedGradientBackground ${containerClassName}`}
    >
      <div
        ref={containerRef}
        className="animatedGradientLayer"
        style={containerStyle}
      />
    </div>
  );
}
