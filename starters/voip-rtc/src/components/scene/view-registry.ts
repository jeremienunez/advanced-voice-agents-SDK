import type { WebGLRenderer } from "three";

/** Tracked viewport rendering for the shared stage canvas: each hologram
    theater registers its placeholder element; the engine scissors that
    rect each frame. Coordinates stay in CSS px — three multiplies
    viewport/scissor by its pixelRatio internally. */

export interface ViewRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface ScissorBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface ViewDrawContext {
  readonly renderer: WebGLRenderer;
  readonly timeMs: number;
  /** device px of this viewport (CSS px × pixel ratio) — feeds uRes. */
  readonly size: { readonly width: number; readonly height: number };
}

export interface SceneView {
  readonly element: HTMLElement;
  draw(context: ViewDrawContext): void;
}

/** Maps a DOM rect to a GL scissor box (lower-left origin), or null when
    the rect cannot produce pixels (zero-size or fully off-viewport). */
export function scissorFor(
  rect: ViewRect,
  viewportW: number,
  viewportH: number,
): ScissorBox | null {
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  if (w <= 0 || h <= 0) return null;
  const x = Math.round(rect.left);
  const y = Math.round(viewportH - rect.top - rect.height);
  if (x + w <= 0 || x >= viewportW) return null;
  if (y + h <= 0 || y >= viewportH) return null;
  return { x, y, w, h };
}

export class ViewRegistry {
  private readonly views = new Set<SceneView>();

  add(view: SceneView): () => void {
    this.views.add(view);
    return () => this.views.delete(view);
  }

  get size(): number {
    return this.views.size;
  }

  forEach(callback: (view: SceneView) => void): void {
    for (const view of this.views) callback(view);
  }
}
