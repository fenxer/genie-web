import { captureElement } from "./capture";
import { mergeConfig, resolveConfig } from "./config";
import { MeshRenderer } from "./gl";
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
import type { GenieConfig, GenieOptions, OriginInput } from "./types";

export type GenieInstance = {
  show: () => Promise<void>;
  hide: () => Promise<void>;
  set: (config: GenieConfig & { origin?: OriginInput }) => void;
  destroy: () => void;
};

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

  async function snapshot() {
    renderer.resize();
    if (
      renderer.cols !== Math.round(config.columns) ||
      renderer.rows !== Math.round(config.rows)
    ) {
      renderer.rebuild(config.columns, config.rows);
    }
    const source = config.capture ? await config.capture(target) : await captureElement(target);
    renderer.upload(source);
    return asRect(target.getBoundingClientRect());
  }

  function run(task: () => Promise<void>) {
    queue = queue.then(task, task);
    return queue;
  }

  const api: GenieInstance = {
    show: () =>
      run(async () => {
        if (destroyed || visible) return;
        cancelAnimationFrame(raf);
        canvas.style.zIndex = String(config.zIndex);
        showTarget();
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        const win = await snapshot();
        const origin = resolveOrigin(originInput);
        hideTarget();
        await animate(1, 0, win, origin);
        if (destroyed) return;
        showTarget();
        renderer.clear();
        visible = true;
      }),

    hide: () =>
      run(async () => {
        if (destroyed || !visible) return;
        cancelAnimationFrame(raf);
        const win = await snapshot();
        const origin = resolveOrigin(originInput);
        hideTarget();
        await animate(0, 1, win, origin);
        if (destroyed) return;
        renderer.clear();
        visible = false;
      }),

    set(patch: GenieConfig & { origin?: OriginInput }) {
      if (patch.origin) originInput = patch.origin;
      config = mergeConfig(config, patch);
      canvas.style.zIndex = String(config.zIndex);
    },

    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
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
