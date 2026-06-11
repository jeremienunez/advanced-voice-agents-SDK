import { useEffect, useRef } from "react";
import { getSceneEngine } from "./scene-engine.js";
import "./styles/SceneLayer.css";

/** Mounts the two persistent deck canvases once inside the studio shell
    and keeps the engine pointed at the active mode. */
export function SceneLayer({ mode }: { mode: string }) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const backdropHost = backdropRef.current;
    const stageHost = stageRef.current;
    if (!backdropHost || !stageHost) return undefined;
    const engine = getSceneEngine();
    if (!engine.available) return undefined;
    return engine.attach(backdropHost, stageHost);
  }, []);

  useEffect(() => {
    getSceneEngine().setDeckMode(mode);
  }, [mode]);

  return (
    <>
      <div ref={backdropRef} className="sceneBackdropLayer" aria-hidden="true" />
      <div ref={stageRef} className="sceneStageLayer" aria-hidden="true" />
    </>
  );
}
