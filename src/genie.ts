import { captureElement, captureWithClone, cloneBitmap } from "./capture";
import { mergeConfig, resolveConfig } from "./config";
import { MeshRenderer } from "./gl";
import { captureHtmlInCanvas, unpark, type ParkHost } from "./html-in-canvas";
import { fillGenie, meshAlpha, timelineEase } from "./math";
import {
  asRect,
  clamp,
  inferDirection,
  lerp,
  prefersReducedMotion,
  resolveOrigin,
  resolveTarget
} from "./rect";
import type {
  CaptureConfig,
  CaptureFn,
  GenieConfig,
  GenieOptions,
  GeniePlayOptions,
  OriginInput,
  SnapshotMode
} from "./types";

export type GenieInstance = {
  show: (opts?: GeniePlayOptions) => Promise<void>;
  hide: (opts?: GeniePlayOptions) => Promise<void>;
  set: (config: GenieConfig & { origin?: OriginInput }) => void;
  /** Drop the cached snapshot. The next `"last"` call recaptures. */
  invalidate: () => void;
  destroy: () => void;
};

function resolveCapture(capture?: CaptureConfig): { take: CaptureFn; clone: boolean } | null {
  if (!capture) return null;
  if (typeof capture === "function") return { take: capture, clone: false };
  return { take: capture.take, clone: Boolean(capture.clone) };
}

export function createGenie(options: GenieOptions): GenieInstance {
  const target = resolveTarget(options.target);
  let originInput: OriginInput = options.origin;
  let config = resolveConfig(options);

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: String(config.zIndex)
  });
  document.body.appendChild(canvas);

  const renderer = new MeshRenderer(canvas);
  renderer.rebuild(config.columns, config.rows);

  let raf = 0;
  let queue = Promise.resolve();
  let visible = false;
  let destroyed = false;
  let parkHost: ParkHost | null = null;
  let lastBitmap: HTMLCanvasElement | null = null;
  let hasGpuTexture = false;

  const skipMotion = () =>
    config.reducedMotion === true ||
    (config.reducedMotion === "auto" && prefersReducedMotion());

  function hideTarget() {
    target.style.setProperty("visibility", "hidden", "important");
    target.style.setProperty("pointer-events", "none", "important");
  }

  function showTarget() {
    target.style.removeProperty("visibility");
    target.style.removeProperty("pointer-events");
  }

  function draw(progress: number, win: ReturnType<typeof asRect>, origin: ReturnType<typeof asRect>) {
    renderer.resize();
    const direction =
      config.direction === "auto" ? inferDirection(win, origin) : config.direction;
    fillGenie(
      progress,
      win,
      origin,
      renderer.positions,
      renderer.cols,
      renderer.rows,
      config,
      direction
    );
    renderer.draw(meshAlpha(progress, config.fadeStart), config.wireframe);
  }

  function animate(from: number, to: number, win: ReturnType<typeof asRect>, origin: ReturnType<typeof asRect>) {
    if (skipMotion()) {
      draw(to, win, origin);
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const start = performance.now();
      const tick = (now: number) => {
        if (destroyed) {
          resolve();
          return;
        }
        const t = timelineEase(clamp((now - start) / config.duration, 0, 1), config.easing);
        draw(lerp(from, to, t), win, origin);
        if (t < 1) {
          raf = requestAnimationFrame(tick);
          return;
        }
        draw(to, win, origin);
        resolve();
      };
      raf = requestAnimationFrame(tick);
    });
  }

  function restorePark() {
    if (!parkHost) return;
    unpark(target, parkHost);
    parkHost = null;
  }

  function remember(source: HTMLCanvasElement | HTMLImageElement) {
    lastBitmap = cloneBitmap(source);
    hasGpuTexture = true;
  }

  function upload(source: HTMLCanvasElement | HTMLImageElement) {
    renderer.upload(source);
    remember(source);
  }

  function prepareMesh() {
    renderer.resize();
    if (
      renderer.cols !== Math.round(config.columns) ||
      renderer.rows !== Math.round(config.rows)
    ) {
      renderer.rebuild(config.columns, config.rows);
    }
  }

  async function snapshot(mode: SnapshotMode, allowPark: boolean) {
    prepareMesh();
    const win = asRect(target.getBoundingClientRect());

    if (mode === "last") {
      if (lastBitmap) {
        renderer.upload(lastBitmap);
        hasGpuTexture = true;
        return win;
      }
      if (hasGpuTexture) return win;
    }

    const custom = resolveCapture(config.capture);
    if (custom) {
      const source = custom.clone
        ? await captureWithClone(target, custom.take)
        : await custom.take(target);
      upload(source);
      return win;
    }

    if (allowPark) {
      try {
        const native = await captureHtmlInCanvas(
          canvas,
          renderer.gl,
          target,
          (el) => {
            const ok = renderer.uploadElement(el);
            if (ok) hasGpuTexture = true;
            return ok;
          },
          (source) => {
            renderer.upload(source);
            if (source instanceof HTMLCanvasElement || source instanceof HTMLImageElement) {
              remember(source);
            } else {
              hasGpuTexture = true;
            }
          },
          (host) => {
            parkHost = host;
          }
        );
        restorePark();
        if (native) return win;
        if (!destroyed) upload(await captureElement(target));
      } catch {
        restorePark();
        if (!destroyed) {
          try {
            upload(await captureElement(target));
          } catch {
            /* keep going with an empty texture rather than deadlock the queue */
          }
        }
      }
      return win;
    }

    try {
      upload(await captureElement(target));
    } catch {
      /* keep going rather than deadlock the queue */
    }
    return win;
  }

  function playMode(opts?: GeniePlayOptions): SnapshotMode {
    return opts?.snapshot ?? config.snapshot;
  }

  function run(task: () => Promise<void>) {
    queue = queue.then(task, task);
    return queue;
  }

  const api: GenieInstance = {
    show: (opts) =>
      run(async () => {
        if (destroyed || visible) return;
        cancelAnimationFrame(raf);
        canvas.style.zIndex = String(config.zIndex);
        const win = await snapshot(playMode(opts), true);
        const origin = resolveOrigin(originInput);
        hideTarget();
        await animate(1, 0, win, origin);
        if (destroyed) return;
        showTarget();
        renderer.release();
        visible = true;
      }),

    hide: (opts) =>
      run(async () => {
        if (destroyed || !visible) return;
        cancelAnimationFrame(raf);
        const win = await snapshot(playMode(opts), false);
        const origin = resolveOrigin(originInput);
        hideTarget();
        draw(0, win, origin);
        await animate(0, 1, win, origin);
        if (destroyed) return;
        renderer.release();
        visible = false;
      }),

    set(patch: GenieConfig & { origin?: OriginInput }) {
      if (patch.origin) originInput = patch.origin;
      config = mergeConfig(config, patch);
      canvas.style.zIndex = String(config.zIndex);
    },

    invalidate() {
      lastBitmap = null;
      hasGpuTexture = false;
    },

    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      restorePark();
      lastBitmap = null;
      hasGpuTexture = false;
      canvas.remove();
      showTarget();
    }
  };

  if (options.open === false) {
    hideTarget();
    visible = false;
  } else if (options.open === true) {
    visible = true;
  } else {
    const cs = getComputedStyle(target);
    visible = cs.display !== "none" && cs.visibility !== "hidden";
    if (!visible) hideTarget();
  }

  return api;
}
