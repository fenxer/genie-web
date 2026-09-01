# genie-web

[English](./README.md) | 简体中文

视觉效果与网格变形（Mesh Warp）算法灵感源自 Chad Etzel 的开源项目 [MeshWarpEffect](https://github.com/jazzychad/MeshWarpEffect)——基于可变形网格实现的 macOS 经典神奇效果（Genie Effect）。`genie-web` 使用 WebGL 将该效果完整移植到了 Web 平台。感谢原作者的开源分享。

```bash
npm i genie-web
# bun add genie-web
```

统一的配置结构（`config`），在原生 JavaScript、React、Vue 及 Svelte 间无缝通用。

这个库负责把 `target` 的**快照**贴到网格上做形变，**不是窗口管理器**：不管 `<dialog>` 生命周期、不管叠层策略、不管内容变了以后怎么失效缓存。静态节点用默认配置即可。可变 UI 要自己管快照时机、`z-index`，以及 `hide()` 之后真 DOM 由谁收场。

> [!NOTE]
> 注意：该移植由 LLM 完成。

## 必选与可选参数

**原生 JavaScript（`createGenie`）— 必选**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `target` | `string \| HTMLElement` | 要做动画的目标。CSS 选择器或 DOM 节点。 |
| `origin` | 见下方说明 | 收起/展开的锚点（Dock 图标、触发按钮等）。 |

**框架组件 — 必选**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `open` | `boolean` | 显隐状态。`true` 展开，`false` 收拢到锚点。 |
| `origin` | 见下方说明 | 同 Vanilla。组件对包裹的子内容/根节点做变形。 |

其余参数均为可选，默认值见下表。

`origin` 支持：

- CSS 选择器字符串（如 `"#dock-icon"`）
- DOM 元素（`Element`）
- `DOMRect` 矩形对象
- 视口像素坐标 `{ left, top, width, height }`

## 配置项

可直接传入 `createGenie({ … })`、调用 `genie.set({ … })` 增量更新，或作为 React / Vue / Svelte 组件的 `config` 传入。Svelte Action 里也可以和 `open` / `origin` 写在同一个扁平对象中。

| 参数名 | 必选 | 默认值 | 类型 | 说明 |
| --- | --- | --- | --- | --- |
| `duration` | 否 | `680` | `number` | 动画时长（毫秒）。 |
| `direction` | 否 | `"auto"` | `"auto" \| "top" \| "right" \| "bottom" \| "left"` | 漏斗接在 `target` 的哪条边。`"auto"` 按 `origin` 相对位置推断。 |
| `slideEnd` | 否 | `0.5` | `number`（`0–1`） | 近边收口完成的进度。越小，漏斗口收得越早。 |
| `translateStart` | 否 | `0.38` | `number`（`0–1`） | 网格整体开始滑向锚点的进度，与收口阶段重叠。 |
| `easing` | 否 | `"linear"` | `"linear" \| "easeOut" \| "easeInOut"` | **整段时间轴**（进度 0 → 1）的缓动，不是漏斗形状。 |
| `curve` | 否 | `"inOut"` | `"inOut" \| "in" \| "out" \| "linear"` | **漏斗侧壁**的弯曲方式，与 `easing` 独立。 |
| `columns` | 否 | `20` | `number` | 网格横向细分。越大越顺滑，也越贵。 |
| `rows` | 否 | `48` | `number` | 网格纵向细分。 |
| `fadeStart` | 否 | `0.88` | `number`（`0–1`） | 网格开始淡出的进度（主要在收起末尾）。 |
| `zIndex` | 否 | `2147483000` | `number` | 覆盖层 Canvas 的 `z-index`。默认几乎压过一切；锚点图标要露在漏斗上面时请调低。 |
| `wireframe` | 否 | `false` | `boolean` | 线框模式，用来看形变。 |
| `reducedMotion` | 否 | `"auto"` | `boolean \| "auto"` | `"auto"` 跟随系统 `prefers-reduced-motion`；`true` 跳过形变；`false` 总是播放。 |
| `snapshot` | 否 | `"fresh"` | `"fresh" \| "last"` | `"fresh"` 每次 show/hide 都重新截图。`"last"` 复用上一次成功的位图（没有则回退到 fresh）。也可单次覆盖：`hide({ snapshot: "last" })`。 |
| `capture` | 否 | 内置快照 | `fn` 或 `{ take, clone? }` | **整段替换**两条内置路径，不是给 html2canvas「增强」。见 [自定义 `capture`](#自定义-capture)。 |
| `open` | 否（仅 Vanilla） | 按 CSS 推断 | `boolean` | `createGenie` 的初始显隐。框架组件请用 `open` 属性。 |

`direction` 示例：

```js
{ direction: "auto" }    // 按相对位置自动选边
{ direction: "bottom" }  // macOS Dock：向下吸入
{ direction: "top" }     // 向上
{ direction: "left" }    // 向左
{ direction: "right" }   // 向右
```

### 时间轴：`easing` 和 `curve` 不是一回事

```
进度     0 ──────── slideEnd ────────────── 1
         [ 漏斗口收拢 →                   ]

              translateStart ────────────── 1
              [ 整网滑向锚点               ]

easing  = 这段进度时钟走得快还是慢
curve   = 收口时侧壁弯成什么样
```

调形变请开 `wireframe: true`。仓库里没有这两个参数的独立 playground。

## 快照生命周期

动画贴的是 `target` 的**位图**，不是实时 DOM。

- **静态节点 + 默认快照：** 不用额外配置。
- **可变 UI（`<dialog>`、懒加载图、列表会换预览）：** 预热、失效、复用都是调用方的事。库不会知道下一次 hide 不该再用同一张图。

实际顺序：

1. `show()` / `hide()` **先 capture，再**把 `target` 设成 `visibility: hidden`。
2. **`show()` 结束**后恢复 visibility。
3. **`hide()` 结束**后 `target` **继续隐藏**，直到下一次 `show()` 走完（或 `destroy()`）。这是给关窗用的。漏了就会「动画没了，节点也没了」。
4. 内置 **`hide()` 再截一次时走的是 SVG 克隆**，即使 `show()` 刚用过 HTML-in-Canvas。两张图可能不一样。要同一张纹理，用 `hide({ snapshot: "last" })`。

### 内置路径（仅在未传 `capture` 时）

1. **HTML-in-Canvas**（浏览器提供则用）— 实验性 [HTML-in-Canvas](https://github.com/WICG/html-in-canvas)（`layoutsubtree`、`drawElementImage` / `texElementImage2D`）。更快、更接近真实绘制。它可能把**真节点临时搬进 canvas**（原位留占位）。自定义 `capture` 不要学这一步。
2. **SVG 克隆** — HTML-in-Canvas 不可用、失败，以及内置 **hide 再截图**时使用。拷计算样式，不搬活树。

该 API 仍是实验性（Chrome origin trial / `chrome://flags/#canvas-draw-element`）。库会自行检测。

### 自定义 `capture`

一旦传入 `capture`，**两条内置路径都不会走**。不要读成「再叠一层 html2canvas」。

```ts
capture?: (el: HTMLElement) => Promise<HTMLCanvasElement | HTMLImageElement>
       | { take: typeof capture; clone?: boolean }
```

约束：

- **不要改正在显示的树。** 不要 park、不要切 `display`、不要把 `target` 挪出文档。capture 发生时用户还看得见这个节点；动活树就会空一帧再回来。
- 如果截图函数不可避免要动 DOM，传 `{ take, clone: true }`。库会克隆 `target`、放到屏幕外，再调用 `take(clone)`。
- 图片没 decode、跨域、滚动条，库都不管。不会帮你等 `img.decode()`，也不会处理 CORS。

## 配方

### 1. 最小可用：静态节点

```js
import { createGenie } from "genie-web";

const genie = createGenie({
  target: "#card",
  origin: "#dock-icon",
  open: false
});

await genie.show();
await genie.hide();
```

默认快照即可。

### 2. 真窗口（藏 DOM、叠层、hide 之后）

库用 `visibility` 藏节点，不用 `display`。`visibility: hidden` 还占布局，下次截图量得到尺寸。`dialog.close()` / `display: none` 会把盒子收成 0×0——下一次 `show()` **之前**先让节点回到布局里。

```js
const genie = createGenie({
  target: dialog,
  origin: icon,
  open: false,
  zIndex: 3 // 压在桌面之上、Dock 图标之下
});

async function openWindow() {
  dialog.show();           // 截图时必须在布局里
  await genie.show();
}

async function closeWindow() {
  await genie.hide({ snapshot: "last" }); // 用展开时那张图；结束后节点仍是 hidden
  dialog.close();          // 关窗是你的事
}
```

叠层：

- 覆盖层默认 `zIndex` 是 `2147483000`。若希望锚点图标压在漏斗上面，要么把图标抬到 overlay 之上，要么把 overlay 调低（canvas 是 `document.body` 上的 `position: fixed`）。
- 动画期间真节点已被 `visibility: hidden`。再留一份可见副本就会双影；overlay 若在真窗口下面，会点不到，网格也被挡住。

### 3. show 和 hide 不是同一张图

除了 `"last"`，没有别的缓存 API。列表选中项变了、收起时要新预览：

```js
genie.invalidate();
await genie.hide({ snapshot: "fresh" });
```

收起要和展开同一帧（或窗口已经在拆）：

```js
await genie.hide({ snapshot: "last" });
```

预热也是调用方的事：图 decode 完、懒加载结束，再 `show()`。从未成功截过图时，`"last"` 会回退到 `"fresh"`。

## 排障

| 现象 | 常见原因 |
| --- | --- |
| 闪一下 / 空一帧再回来 | `capture` 挪走或藏了活节点。用 `{ clone: true }`，或不要动可见树。HTML-in-Canvas 在 `show()` 时也可能 park `target`。 |
| 收起和展开长得不一样 | 默认 hide 会再走一遍 SVG 截图，即使 show 用了 HTML-in-Canvas。改用 `snapshot: "last"`。 |
| 吸入层在窗口下面 / 上面 | `zIndex` 和局部层叠上下文。canvas 在 `document.body` 上；图标若在 `transform` 父级里，本地 `z-index` 压不过 overlay。 |
| 收起后节点消失 | `hide()` 结束后会保持 `visibility: hidden`，直到下一次 `show()` 完成。关窗就配合 `dialog.close()`；要恢复样式请 `destroy()`。 |
| 下次 `show()` 变成空白 / 0 尺寸 | 截图时已经 `display: none` 或 `dialog.close()`。先回到布局，哪怕仍是 `visibility: hidden`。 |
| 传了 html2canvas，内置 HiC/SVG 全没了 | 符合设计。设置 `capture` 会整段替换内置路径。 |

## 原生 JavaScript（Vanilla）

```js
import { createGenie } from "genie-web";

const genie = createGenie({
  target: "#window",
  origin: "#dock-icon",
  duration: 680,
  direction: "auto"
});

await genie.show();
await genie.hide({ snapshot: "last" });
genie.set({ duration: 400, origin: "#other-icon", direction: "bottom" });
genie.invalidate();
genie.destroy();
```

| 方法 | 说明 |
| --- | --- |
| `show(opts?)` | 从锚点 `origin` 展开到 `target`，返回 Promise。 |
| `hide(opts?)` | 从 `target` 收拢到 `origin`。Promise resolve 时目标仍是 `visibility: hidden`。 |
| `set(config)` | 增量更新配置（包括 `origin`），下次 `show()` / `hide()` 生效。 |
| `invalidate()` | 丢掉缓存快照。下一次 `"last"` 会重新截取。 |
| `destroy()` | 停动画、移除覆盖层 Canvas、恢复目标元素样式。 |

`opts.snapshot` 只覆盖这一次调用的 `config.snapshot`。

## React

必选属性：`open`、`origin`。可选属性：`config`、`className`、`style`。

```tsx
import { Genie } from "genie-web/react";

<Genie
  open={open}
  origin={iconRef}
  config={{ duration: 680, direction: "bottom", snapshot: "last" }}
>
  <div className="window">…</div>
</Genie>
```

## Vue

必选属性：`open`、`origin`。可选属性：`config`。组件上的其他属性（如 `class`、`style`）将自动透传至外层包裹的 `div` 容器。

```vue
<script setup>
import { Genie } from "genie-web/vue";
</script>

<Genie :open="open" :origin="iconEl" :config="{ duration: 680, direction: 'auto' }">
  <div class="window">…</div>
</Genie>
```

## Svelte

**Action 指令** — 必选参数：`open`、`origin`。可选参数：任意配置项均可与前两者平铺写在同一对象中。

```svelte
<script>
  import { genie } from "genie-web/svelte";
</script>

<div use:genie={{ open, origin: iconEl, duration: 680, direction: "left" }}>
  …
</div>
```

**组件方式** — 必选属性：`open`、`origin`。可选属性：`config`。

```svelte
<script>
  import Genie from "genie-web/svelte/Genie.svelte";
</script>

<Genie {open} origin={iconEl} config={{ duration: 680, direction: "auto" }}>
  …
</Genie>
```
