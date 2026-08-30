import type { CurveEase, Direction, Rect, ResolvedConfig, TimelineEase } from "./types";
import { clamp, lerp } from "./rect";

function quadEaseInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export function curveEase(t: number, name: CurveEase) {
  if (name === "in") return t * t;
  if (name === "out") return 1 - (1 - t) * (1 - t);
  if (name === "linear") return t;
  return quadEaseInOut(t);
}

export function timelineEase(t: number, name: TimelineEase) {
  if (name === "easeOut") return 1 - (1 - t) ** 3;
  if (name === "easeInOut") return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  return t;
}

export function fillGenie(
  progress: number,
  win: Rect,
  origin: Rect,
  out: Float32Array,
  cols: number,
  rows: number,
  config: ResolvedConfig,
  direction: Direction
) {
  const slideEnd = Math.max(0.05, config.slideEnd);
  const translateStart = clamp(config.translateStart, 0, 0.95);
  const slide = clamp(progress / slideEnd, 0, 1);
  const translate = clamp((progress - translateStart) / (1 - translateStart), 0, 1);
  const ease = (t: number) => curveEase(t, config.curve);

  if (direction === "left" || direction === "right") {
    fillHorizontal(win, origin, out, cols, rows, slide, translate, direction === "left", ease);
    return;
  }
  fillVertical(win, origin, out, cols, rows, slide, translate, direction === "top", ease);
}

function fillVertical(
  win: Rect,
  dock: Rect,
  out: Float32Array,
  cols: number,
  rows: number,
  slide: number,
  translate: number,
  toTop: boolean,
  ease: (t: number) => number
) {
  let topY: number;
  let bottomY: number;
  if (toTop) {
    const dy = dock.bottom - win.bottom;
    topY = Math.max(win.top + translate * dy, dock.top);
    bottomY = win.bottom + translate * dy;
  } else {
    const dy = dock.top - win.top;
    topY = win.top + translate * dy;
    bottomY = Math.min(win.bottom + translate * dy, dock.bottom);
  }

  const leftMouth = lerp(win.left, dock.left, slide);
  const rightMouth = lerp(win.right, dock.right, slide);
  const curveH = Math.max(toTop ? win.bottom - dock.bottom : dock.top - win.top, 1);

  const edgeX = (y: number, farX: number, mouthX: number) => {
    if (toTop) {
      if (y >= win.bottom) return farX;
      if (y <= dock.bottom) return mouthX;
      return lerp(farX, mouthX, ease((win.bottom - y) / curveH));
    }
    if (y <= win.top) return farX;
    if (y >= dock.top) return mouthX;
    return lerp(farX, mouthX, ease((y - win.top) / curveH));
  };

  let i = 0;
  for (let r = 0; r <= rows; r++) {
    const y = lerp(topY, bottomY, r / rows);
    const x0 = edgeX(y, win.left, leftMouth);
    const x1 = edgeX(y, win.right, rightMouth);
    for (let c = 0; c <= cols; c++) {
      out[i++] = lerp(x0, x1, c / cols);
      out[i++] = y;
    }
  }
}

function fillHorizontal(
  win: Rect,
  dock: Rect,
  out: Float32Array,
  cols: number,
  rows: number,
  slide: number,
  translate: number,
  toLeft: boolean,
  ease: (t: number) => number
) {
  let leftX: number;
  let rightX: number;
  if (toLeft) {
    const dx = dock.right - win.right;
    leftX = Math.max(win.left + translate * dx, dock.left);
    rightX = win.right + translate * dx;
  } else {
    const dx = dock.left - win.left;
    leftX = win.left + translate * dx;
    rightX = Math.min(win.right + translate * dx, dock.right);
  }

  const topMouth = lerp(win.top, dock.top, slide);
  const bottomMouth = lerp(win.bottom, dock.bottom, slide);
  const curveW = Math.max(toLeft ? win.right - dock.right : dock.left - win.left, 1);

  const edgeY = (x: number, farY: number, mouthY: number) => {
    if (toLeft) {
      if (x >= win.right) return farY;
      if (x <= dock.right) return mouthY;
      return lerp(farY, mouthY, ease((win.right - x) / curveW));
    }
    if (x <= win.left) return farY;
    if (x >= dock.left) return mouthY;
    return lerp(farY, mouthY, ease((x - win.left) / curveW));
  };

  let i = 0;
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const x = lerp(leftX, rightX, c / cols);
      const y0 = edgeY(x, win.top, topMouth);
      const y1 = edgeY(x, win.bottom, bottomMouth);
      out[i++] = x;
      out[i++] = lerp(y0, y1, r / rows);
    }
  }
}

export function meshAlpha(progress: number, fadeStart: number) {
  const start = clamp(fadeStart, 0.5, 0.99);
  if (progress < start) return 1;
  return 1 - (progress - start) / (1 - start);
}
