import { scissorFor } from "../../../src/components/scene/view-registry.js";

const results = [
  scenarioScissorMapsRectsAndCullsOffscreen(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioScissorMapsRectsAndCullsOffscreen(): string {
  /* a 200x100 rect at (40, 60) on a 1000x800 viewport: GL origin is the
     lower-left, so y = 800 - 60 - 100 = 640 */
  const box = scissorFor({ left: 40, top: 60, width: 200, height: 100 }, 1000, 800);
  assert(box !== null, "an on-screen rect must produce a scissor box");
  assert(box!.x === 40 && box!.y === 640 && box!.w === 200 && box!.h === 100, `wrong mapping: ${JSON.stringify(box)}`);

  /* fully above the viewport */
  assert(scissorFor({ left: 40, top: -200, width: 200, height: 100 }, 1000, 800) === null, "a rect above the viewport must be culled");
  /* fully below */
  assert(scissorFor({ left: 40, top: 900, width: 200, height: 100 }, 1000, 800) === null, "a rect below the viewport must be culled");
  /* fully left/right */
  assert(scissorFor({ left: -300, top: 60, width: 200, height: 100 }, 1000, 800) === null, "a rect left of the viewport must be culled");
  assert(scissorFor({ left: 1100, top: 60, width: 200, height: 100 }, 1000, 800) === null, "a rect right of the viewport must be culled");
  /* zero-size (display:none / unmounted) */
  assert(scissorFor({ left: 0, top: 0, width: 0, height: 0 }, 1000, 800) === null, "a zero-size rect must be culled");
  /* partially visible rects are kept (the GPU clamps the scissor) */
  assert(scissorFor({ left: -50, top: 60, width: 200, height: 100 }, 1000, 800) !== null, "a partially visible rect must be kept");

  return "scissor-maps-rects-and-culls-offscreen";
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(JSON.stringify({ status: "failed", message }));
    process.exit(1);
  }
}
