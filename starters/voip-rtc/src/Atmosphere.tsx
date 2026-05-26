import { useEffect, useRef } from "react";
import { runAtmosphere } from "./components/atmosphere/animation.js";

interface AtmosphereProps {
  className?: string;
}

export function Atmosphere({ className = "atmosphere" }: AtmosphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return runAtmosphere(canvas);
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
