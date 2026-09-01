type HtmlCanvas = HTMLCanvasElement & {
  layoutSubtree?: boolean;
  requestPaint?: () => void;
  captureElementImage?: (element: Element) => { close?: () => void };
};

type GlHtml = WebGLRenderingContext & {
  texElementImage2D?: (...args: unknown[]) => void;
  texElementSubImage2D?: (...args: unknown[]) => void;
  texElement2D?: (...args: unknown[]) => void;
};

type Draw2D = CanvasRenderingContext2D & {
  drawElementImage?: (...args: unknown[]) => unknown;
};

export type ParkHost = {
  parent: Node;
  placeholder: ChildNode;
  styleAttr: string | null;
  hadDrawable: boolean;
  scratch: HTMLCanvasElement | null;
  released: boolean;
};

function htmlCanvas(el: HTMLCanvasElement) {
  return el as HtmlCanvas;
}

function glHtml(gl: WebGLRenderingContext) {
  return gl as GlHtml;
}

export function enableLayoutSubtree(canvas: HTMLCanvasElement) {
  canvas.setAttribute("layoutsubtree", "true");
  const node = htmlCanvas(canvas);
  if ("layoutSubtree" in canvas) node.layoutSubtree = true;
}

function hasLayoutSubtree(canvas: HTMLCanvasElement) {
  return (
    "layoutSubtree" in canvas ||
    typeof htmlCanvas(canvas).requestPaint === "function"
  );
}

function hasGlElementUpload(gl: WebGLRenderingContext) {
  const g = glHtml(gl);
  return (
    typeof g.texElementImage2D === "function" ||
    typeof g.texElementSubImage2D === "function" ||
    typeof g.texElement2D === "function"
  );
}

function has2dElementDraw() {
  const probe = document.createElement("canvas");
  enableLayoutSubtree(probe);
  probe.width = 1;
  probe.height = 1;
  const ctx = probe.getContext("2d") as Draw2D | null;
  return typeof ctx?.drawElementImage === "function";
}

export function supportsHtmlInCanvas(canvas: HTMLCanvasElement, gl: WebGLRenderingContext) {
  return hasLayoutSubtree(canvas) && (hasGlElementUpload(gl) || has2dElementDraw());
}

function otherCanvasAncestor(el: Element, overlay: HTMLCanvasElement) {
  const ancestor = el.closest("canvas");
  return Boolean(ancestor && ancestor !== overlay);
}

function glNoError(gl: WebGLRenderingContext) {
  return gl.getError() === gl.NO_ERROR;
}

export function texElementImage(gl: WebGLRenderingContext, el: Element | object) {
  const g = glHtml(gl);
  g.getError();
  const rgba8 = (gl as WebGL2RenderingContext).RGBA8 ?? 0x8058;

  const tryCall = (fn: ((...args: unknown[]) => void) | undefined, args: unknown[]) => {
    if (typeof fn !== "function") return false;
    try {
      fn.apply(gl, args);
      return glNoError(gl);
    } catch {
      g.getError();
      return false;
    }
  };

  // Current Chromium / WICG webGL.html: texElementImage2D(target, internalformat, element)
  if (tryCall(g.texElementImage2D, [gl.TEXTURE_2D, rgba8, el])) return true;
  if (tryCall(g.texElementImage2D, [gl.TEXTURE_2D, gl.RGBA, el])) return true;

  // Older Canary / Three.js HTMLTexture: texImage2D-shaped 6-arg
  if (
    tryCall(g.texElementImage2D, [
      gl.TEXTURE_2D,
      0,
      rgba8,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      el
    ])
  ) {
    return true;
  }
  if (
    tryCall(g.texElementImage2D, [
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      el
    ])
  ) {
    return true;
  }
  if (tryCall(g.texElement2D, [gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el])) {
    return true;
  }

  return false;
}

function waitForPaint(canvas: HTMLCanvasElement, run: () => boolean, ms: number) {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let paints = 0;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      canvas.removeEventListener("paint", onPaint);
      resolve(ok);
    };
    const onPaint = () => {
      paints += 1;
      // Three.js HTMLTexture: after appendChild, skip upload on that frame and
      // requestPaint again. First paints often throw "snapshot not recorded".
      if (paints < 2) {
        htmlCanvas(canvas).requestPaint?.();
        return;
      }
      try {
        if (run()) finish(true);
        else htmlCanvas(canvas).requestPaint?.();
      } catch {
        htmlCanvas(canvas).requestPaint?.();
      }
    };
    canvas.addEventListener("paint", onPaint);
    requestAnimationFrame(() => htmlCanvas(canvas).requestPaint?.());
    setTimeout(() => finish(false), ms);
  });
}

function scratchHasContent(ctx: CanvasRenderingContext2D, w: number, h: number) {
  try {
    const p = ctx.getImageData(Math.floor(w / 2), Math.floor(h / 2), 1, 1).data;
    return p[3] > 8 && (p[0] > 16 || p[1] > 16 || p[2] > 16);
  } catch {
    return false;
  }
}

function makePlaceholder(el: HTMLElement, rect: DOMRectReadOnly) {
  const cs = getComputedStyle(el);
  if (cs.position === "fixed" || cs.position === "absolute") {
    return document.createComment("genie-web");
  }
  const ph = document.createElement("div");
  ph.setAttribute("aria-hidden", "true");
  ph.style.cssText = [
    `display:${cs.display === "inline" ? "inline-block" : cs.display}`,
    `width:${rect.width}px`,
    `height:${rect.height}px`,
    `margin:${cs.margin}`,
    `flex:${cs.flex}`,
    "visibility:hidden",
    "pointer-events:none",
    "box-sizing:border-box"
  ].join(";");
  return ph;
}

function markDrawable(el: HTMLElement) {
  el.setAttribute("drawable", "");
}

function placeInCanvas(el: HTMLElement, dest: HTMLCanvasElement) {
  markDrawable(el);
  el.style.position = "absolute";
  el.style.left = "0";
  el.style.top = "0";
  el.style.right = "0";
  el.style.bottom = "0";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.margin = "0";
  el.style.boxSizing = "border-box";
  el.style.maxWidth = "none";
  el.style.maxHeight = "none";
  el.style.transform = "none";
  el.style.setProperty("visibility", "visible", "important");
  el.style.setProperty("opacity", "1", "important");
  dest.appendChild(el);
}

export function park(
  el: HTMLElement,
  dest: HTMLCanvasElement,
  rect: DOMRectReadOnly,
  scratch: HTMLCanvasElement | null
): ParkHost {
  const parent = el.parentNode;
  if (!parent) throw new Error("genie-web: target is detached");
  const host: ParkHost = {
    parent,
    placeholder: makePlaceholder(el, rect),
    styleAttr: el.getAttribute("style"),
    hadDrawable: el.hasAttribute("drawable"),
    scratch,
    released: false
  };
  parent.insertBefore(host.placeholder, el);
  try {
    placeInCanvas(el, dest);
  } catch (err) {
    host.placeholder.replaceWith(el);
    throw err;
  }
  return host;
}

export function unpark(el: HTMLElement, host: ParkHost) {
  if (host.released) return;
  host.released = true;
  try {
    if (host.placeholder.isConnected) {
      host.placeholder.replaceWith(el);
    } else if (el.parentNode !== host.parent && host.parent.isConnected) {
      host.parent.appendChild(el);
    }
  } finally {
    if (host.styleAttr === null) el.removeAttribute("style");
    else el.setAttribute("style", host.styleAttr);
    if (!host.hadDrawable) el.removeAttribute("drawable");
    host.scratch?.remove();
  }
}

function makeScratch(rect: DOMRectReadOnly) {
  const scratch = document.createElement("canvas");
  enableLayoutSubtree(scratch);
  Object.assign(scratch.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    pointerEvents: "none",
    opacity: "1",
    zIndex: "1"
  });
  document.body.appendChild(scratch);
  const dpr = window.devicePixelRatio || 1;
  scratch.width = Math.max(1, Math.round(rect.width * dpr));
  scratch.height = Math.max(1, Math.round(rect.height * dpr));
  scratch.getContext("2d", { willReadFrequently: true });
  return scratch;
}

function drawElementTo2D(scratch: HTMLCanvasElement, el: HTMLElement) {
  const ctx = scratch.getContext("2d", { willReadFrequently: true }) as Draw2D | null;
  if (!ctx?.drawElementImage) return false;
  const w = scratch.width;
  const h = scratch.height;
  const cssW = scratch.clientWidth || w;
  const cssH = scratch.clientHeight || h;
  const attempts: Array<() => void> = [
    () => {
      if ("reset" in ctx) ctx.reset();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawElementImage(el, 0, 0);
    },
    () => {
      if ("reset" in ctx) ctx.reset();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawElementImage(el, 0, 0, w, h);
    },
    () => {
      if ("reset" in ctx) ctx.reset();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawElementImage(el, 0, 0, cssW, cssH, 0, 0, w, h);
    }
  ];
  for (const attempt of attempts) {
    try {
      attempt();
      if (scratchHasContent(ctx, w, h)) return true;
    } catch {
      /* snapshot not ready, or this overload is unsupported */
    }
  }
  return false;
}

export async function captureHtmlInCanvas(
  overlay: HTMLCanvasElement,
  gl: WebGLRenderingContext,
  el: HTMLElement,
  uploadElement: (node: Element | object) => boolean,
  uploadImage: (source: TexImageSource) => void,
  onPark: (host: ParkHost) => void
): Promise<boolean> {
  if (!el.isConnected) return false;
  if (otherCanvasAncestor(el, overlay)) return false;
  if (!supportsHtmlInCanvas(overlay, gl)) return false;

  const rect = el.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;

  // Dual-canvas (liquid-canvas): HTML lives on a 2D layoutsubtree canvas.
  // texElementImage2D on a WebGL canvas that also has layoutsubtree often
  // reports success with an empty, opaque-black texture.
  if (has2dElementDraw()) {
    const scratch = makeScratch(rect);
    const host = park(el, scratch, rect, scratch);
    onPark(host);
    return waitForPaint(
      scratch,
      () => {
        if (!drawElementTo2D(scratch, el)) return false;
        uploadImage(scratch);
        return true;
      },
      1200
    );
  }

  if (!hasGlElementUpload(gl)) return false;
  enableLayoutSubtree(overlay);
  const host = park(el, overlay, rect, null);
  onPark(host);
  return waitForPaint(overlay, () => uploadElement(el), 1200);
}
