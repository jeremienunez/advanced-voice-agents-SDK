import { useEffect, useRef } from "react";
import {
  type AtmosphereMode,
  runAtmosphere,
} from "./components/atmosphere/animation.js";

interface AtmosphereProps {
  className?: string;
  mode?: AtmosphereMode;
}

export function Atmosphere({
  className = "atmosphere",
  mode = "onboarding",
}: AtmosphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return runAtmosphere(canvas, { mode });
  }, [mode]);

  return (
    <canvas
      ref={canvasRef}
      className={`${className} atmosphere-${mode}`}
      aria-hidden="true"
    />
  );
}
