import * as THREE from "three";
import type { BackdropScene } from "./backdrop-scene.js";
import { deckTargetFor, easeDeck, type DeckState } from "./mode-director.js";
import {
  deckTransitionRate,
  prefersStaticMotion,
  staticFrameTimeMs,
  watchMotionPreference,
} from "./scene-motion-policy.js";
import { watchScenePalette, type ScenePalette } from "./scene-theme.js";
import { scissorFor, ViewRegistry, type SceneView } from "./view-registry.js";

/** Owns the two persistent canvases (backdrop + scissored stage), the
    single rAF loop, theme/motion subscriptions, and context-loss
    recovery. Composition only — never subclass three classes. */
export class SceneEngine {
  readonly available: boolean;
  readonly failureReason: string | null;
  private readonly stage: THREE.WebGLRenderer | null = null;
  private readonly backdropRenderer: THREE.WebGLRenderer | null = null;
  private readonly views = new ViewRegistry();
  private backdrop: BackdropScene | null = null;
  private palette: ScenePalette | null = null;
  private deck: DeckState = deckTargetFor("command", 0);
  private deckTarget: DeckState = this.deck;
  private modeName = "command";
  private intensity = 0;
  private pointer = { x: 0, y: 0 };
  private frameId = 0;
  private running = false;
  private reduced = prefersStaticMotion();

  constructor() {
    try {
      this.stage = makeRenderer();
      this.backdropRenderer = makeRenderer();
      this.available = true;
      this.failureReason = null;
    } catch (error) {
      this.available = false;
      this.failureReason = error instanceof Error ? error.message : "webgl unavailable";
      return;
    }
    watchScenePalette((palette) => {
      this.palette = palette;
      this.requestStaticFrame();
    });
    watchMotionPreference((reduced) => {
      this.reduced = reduced;
      this.syncLoop();
    });
    window.addEventListener("pointermove", (event) => {
      this.pointer = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: (event.clientY / window.innerHeight) * 2 - 1,
      };
    });
    window.addEventListener("resize", () => this.resize());
    for (const renderer of [this.stage, this.backdropRenderer]) {
      renderer.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault());
      renderer.domElement.addEventListener("webglcontextrestored", () => this.requestStaticFrame());
    }
    this.resize();
  }

  /** SceneLayer hands over its host divs; canvases attach/detach there. */
  attach(backdropHost: HTMLElement, stageHost: HTMLElement): () => void {
    if (!this.stage || !this.backdropRenderer) return () => {};
    backdropHost.appendChild(this.backdropRenderer.domElement);
    stageHost.appendChild(this.stage.domElement);
    this.resize();
    this.syncLoop();
    return () => {
      this.backdropRenderer?.domElement.remove();
      this.stage?.domElement.remove();
      this.syncLoop();
    };
  }

  registerView(view: SceneView): () => void {
    const remove = this.views.add(view);
    this.syncLoop();
    this.requestStaticFrame();
    return () => {
      remove();
      this.syncLoop();
    };
  }

  setBackdrop(backdrop: BackdropScene | null): void {
    this.backdrop?.dispose();
    this.backdrop = backdrop;
    this.requestStaticFrame();
  }

  setDeckMode(mode: string): void {
    this.modeName = mode;
    this.deckTarget = deckTargetFor(mode, this.intensity);
    this.requestStaticFrame();
  }

  setDeckIntensity(value: number): void {
    this.intensity = Math.min(Math.max(value, 0), 1);
    this.deckTarget = deckTargetFor(this.modeName, this.intensity);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.stage?.setSize(w, h, false);
    this.backdropRenderer?.setSize(w, h, false);
    this.requestStaticFrame();
  }

  /** Continuous loop only while animated AND something is attached. */
  private syncLoop(): void {
    const shouldRun =
      !this.reduced && this.stage !== null && this.stage.domElement.isConnected;
    if (shouldRun && !this.running) {
      this.running = true;
      const tick = (stamp: number) => {
        if (!this.running) return;
        this.renderFrame(stamp);
        this.frameId = requestAnimationFrame(tick);
      };
      this.frameId = requestAnimationFrame(tick);
    } else if (!shouldRun && this.running) {
      this.running = false;
      cancelAnimationFrame(this.frameId);
      this.requestStaticFrame();
    }
  }

  /** Under reduced motion (or after theme/mode changes while paused),
      render exactly one settled frame at the frozen pose time. */
  private requestStaticFrame(): void {
    if (this.running || !this.stage?.domElement.isConnected) return;
    this.deck = this.deckTarget;
    this.renderFrame(staticFrameTimeMs());
  }

  private renderFrame(timeMs: number): void {
    const stage = this.stage;
    const backdropRenderer = this.backdropRenderer;
    if (!stage || !backdropRenderer) return;
    const rate = deckTransitionRate(this.reduced);
    this.deck = rate >= 1 ? this.deckTarget : easeDeck(this.deck, this.deckTarget);

    if (this.backdrop && this.palette) {
      this.backdrop.update(timeMs, this.deck, this.palette, this.pointer);
      backdropRenderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
      backdropRenderer.clear();
      backdropRenderer.render(this.backdrop.scene, this.backdrop.camera);
    } else {
      backdropRenderer.clear();
    }

    stage.setScissorTest(false);
    stage.clear();
    stage.setScissorTest(true);
    const ratio = stage.getPixelRatio();
    this.views.forEach((view) => {
      const rect = view.element.getBoundingClientRect();
      const box = scissorFor(rect, window.innerWidth, window.innerHeight);
      if (!box) return;
      stage.setViewport(box.x, box.y, box.w, box.h);
      stage.setScissor(box.x, box.y, box.w, box.h);
      view.draw({
        renderer: stage,
        timeMs,
        size: { width: box.w * ratio, height: box.h * ratio },
      });
    });
  }
}

function makeRenderer(): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  return renderer;
}

let singleton: SceneEngine | null = null;

export function getSceneEngine(): SceneEngine {
  if (!singleton) singleton = new SceneEngine();
  return singleton;
}
