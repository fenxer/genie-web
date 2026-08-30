export type Direction = "top" | "right" | "bottom" | "left";

export type CurveEase = "inOut" | "in" | "out" | "linear";

export type TimelineEase = "linear" | "easeOut" | "easeInOut";

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
  capture?: (el: HTMLElement) => Promise<HTMLCanvasElement | HTMLImageElement>;
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
  capture?: GenieConfig["capture"];
};
