import type { Direction, OriginInput, Rect, TargetInput } from "./types";

export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function asRect(r: {
  left: number;
  top: number;
  width: number;
  height: number;
}): Rect {
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
    right: r.left + r.width,
    bottom: r.top + r.height
  };
}

export function resolveTarget(input: TargetInput): HTMLElement {
  if (typeof input === "string") {
    const el = document.querySelector(input);
    if (!(el instanceof HTMLElement)) {
      throw new Error(`genie-web: target "${input}" not found`);
    }
    return el;
  }
  return input;
}

export function resolveOrigin(input: OriginInput): Rect {
  if (typeof input === "string") {
    const el = document.querySelector(input);
    if (!(el instanceof Element)) {
      throw new Error(`genie-web: origin "${input}" not found`);
    }
    return asRect(el.getBoundingClientRect());
  }
  if (input instanceof Element) {
    return asRect(input.getBoundingClientRect());
  }
  if (input instanceof DOMRect) {
    return asRect(input);
  }
  return asRect(input);
}

export function inferDirection(target: Rect, origin: Rect): Direction {
  const dx = origin.left + origin.width / 2 - (target.left + target.width / 2);
  const dy = origin.top + origin.height / 2 - (target.top + target.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

export function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
