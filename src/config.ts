import type { GenieConfig, ResolvedConfig } from "./types";

export const defaults: ResolvedConfig = {
  duration: 680,
  slideEnd: 0.5,
  translateStart: 0.38,
  easing: "linear",
  curve: "inOut",
  columns: 20,
  rows: 48,
  fadeStart: 0.88,
  direction: "auto",
  zIndex: 2147483000,
  wireframe: false,
  reducedMotion: "auto",
  snapshot: "fresh"
};

export function resolveConfig(input: GenieConfig = {}): ResolvedConfig {
  return { ...defaults, ...input };
}

export function mergeConfig(base: ResolvedConfig, patch: GenieConfig): ResolvedConfig {
  return { ...base, ...patch };
}
