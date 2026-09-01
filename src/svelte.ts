import { createGenie, type GenieInstance } from "./genie";
import type { GenieConfig, OriginInput } from "./types";

export type SvelteGenieParams = GenieConfig & {
  open: boolean;
  origin: OriginInput;
};

/** Svelte action: `<div use:genie={{ open, origin, duration: 680 }}>` */
export function genie(node: HTMLElement, params: SvelteGenieParams) {
  let { open, origin, ...config } = params;
  let api: GenieInstance = createGenie({
    target: node,
    origin,
    open,
    ...config
  });

  return {
    update(next: SvelteGenieParams) {
      const { open: nextOpen, origin: nextOrigin, ...nextConfig } = next;
      api.set({ origin: nextOrigin, ...nextConfig });
      if (nextOpen !== open) {
        open = nextOpen;
        void (open ? api.show() : api.hide());
      }
    },
    destroy() {
      api.destroy();
    }
  };
}

export { createGenie, defaults } from "./index";
export type {
  CaptureConfig,
  GenieConfig,
  GenieInstance,
  GeniePlayOptions,
  OriginInput,
  SnapshotMode
} from "./index";
