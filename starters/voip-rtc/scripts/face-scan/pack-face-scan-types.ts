export interface LumMap {
  x0: number;
  y0: number;
  step: number;
  lw: number;
  lh: number;
  data: number[];
}

export interface OutlineTrace {
  w: number;
  h: number;
  left: number[][];
  right: number[][];
  lum: LumMap;
}

export interface RawScan {
  w: number;
  h: number;
  landmarks: number[][];
  oval: number[];
  samples: number[][];
  outlineFront: OutlineTrace;
  outlineSide: OutlineTrace;
  outlineBack: OutlineTrace;
}

export interface EllipseSection {
  xc: number;
  a: number;
  zc: number;
  b: number;
}

export type PixelProjector = (x: number, y: number) => [number, number];
