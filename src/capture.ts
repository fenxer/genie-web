function copyComputed(from: Element, to: Element) {
  if (!(from instanceof HTMLElement) || !(to instanceof HTMLElement)) return;
  const cs = getComputedStyle(from);
  let css = cs.cssText;
  if (!css) {
    const parts: string[] = [];
    for (let i = 0; i < cs.length; i++) {
      const key = cs.item(i);
      parts.push(`${key}:${cs.getPropertyValue(key)};`);
    }
    css = parts.join("");
  }
  to.style.cssText = css;
  const fromKids = [...from.children];
  const toKids = [...to.children];
  for (let i = 0; i < fromKids.length; i++) copyComputed(fromKids[i], toKids[i]);
}

export async function captureElement(el: HTMLElement): Promise<HTMLCanvasElement> {
  const rect = el.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));

  const clone = el.cloneNode(true) as HTMLElement;
  copyComputed(el, clone);
  clone.style.margin = "0";
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject width="100%" height="100%" transform="scale(${dpr})">${new XMLSerializer().serializeToString(clone)}</foreignObject>` +
    `</svg>`;

  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("genie-web: snapshot failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("genie-web: 2d context unavailable");
    ctx.drawImage(img, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
