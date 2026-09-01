export type Direction = "top" | "right" | "bottom" | "left";

export type CurveEase = "inOut" | "in" | "out" | "linear";

export type TimelineEase = "linear" | "easeOut" | "easeInOut";

export type SnapshotMode = "fresh" | "last";

export type Rect = {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

export type OriginInput =
  | string
  | Element
  | DOMRect
  | { left: number; top: number; width: number; height: number };

export type TargetInput = string | HTMLElement;

export type CaptureFn = (el: HTMLElement) => Promise<HTMLCanvasElement | HTMLImageElement>;

/**
 * Custom snapshot. A bare function replaces both built-in paths.
 * `{ take, clone: true }` snapshots an offscreen clone so `take` never mutates the live tree.
 */
export type CaptureConfig = CaptureFn | { take: CaptureFn; clone?: boolean };

/** Per-call override for `show()` / `hide()`. */
export type GeniePlayOptions = {
  snapshot?: SnapshotMode;
};

/** All tunables live here. Framework wrappers pass the same object. */
export type GenieConfig = {
  duration?: number;
  slideEnd?: number;
  translateStart?: number;
  easing?: TimelineEase;
  curve?: CurveEase;
  columns?: number;
  rows?: number;
  fadeStart?: number;
  direction?: Direction | "auto";
  zIndex?: number;
  wireframe?: boolean;
  reducedMotion?: boolean | "auto";
  capture?: CaptureConfig;
  /**
   * `"fresh"` (default) recaptures `target` on every show/hide.
   * `"last"` reuses the previous successful snapshot; falls back to fresh if none exists.
   */
  snapshot?: SnapshotMode;
};

export type GenieOptions = GenieConfig & {
  target: TargetInput;
  origin: OriginInput;
  /** Current visibility. Default: inferred from the element's computed style. */
  open?: boolean;
};

export type ResolvedConfig = {
  duration: number;
  slideEnd: number;
  translateStart: number;
  easing: TimelineEase;
  curve: CurveEase;
  columns: number;
  rows: number;
  fadeStart: number;
  direction: Direction | "auto";
  zIndex: number;
  wireframe: boolean;
  reducedMotion: boolean | "auto";
  snapshot: SnapshotMode;
  capture?: CaptureConfig;
};
