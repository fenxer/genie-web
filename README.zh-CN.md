# genie-web

[English](./README.md) | 简体中文

视觉效果与网格变形（Mesh Warp）算法灵感源自 Chad Etzel 的开源项目 [MeshWarpEffect](https://github.com/jazzychad/MeshWarpEffect)——基于可变形网格实现的 macOS 经典神奇效果（Genie Effect）。`genie-web` 使用 WebGL 将该效果完整移植到了 Web 平台。感谢原作者的开源分享。

```bash
npm i genie-web
# bun add genie-web
```

统一的配置结构（`config`），在原生 JavaScript、React、Vue 及 Svelte 间无缝通用。

> [!NOTE]
> 注意：该移植由 LLM 完成。

## 必选与可选参数

**原生 JavaScript（**`createGenie`**）— 必选**


| 字段       | 类型      | 说明                            |
| -------- | ------- | ----------------------------- |
| `target` | `string | HTMLElement`                  |
| `origin` | 见下方说明   | 动画收起/展开的锚点位置（如 Dock 图标或触发按钮）。 |


**框架组件 — 必选**


| 字段       | 类型        | 说明                                         |
| -------- | --------- | ------------------------------------------ |
| `open`   | `boolean` | 当前显隐状态。`true` 触发展开动效，`false` 触发收拢至锚点动效。    |
| `origin` | 见下方说明     | 动效吸入与呼出的锚点（同 Vanilla）。组件将对其包裹的子内容/根节点应用变形。 |


其余参数均为可选，默认值请参考下表。

`origin` 支持以下传参类型：

- CSS 选择器字符串（如 `"#dock-icon"`）
- DOM 元素（`Element`）
- `DOMRect` 矩形对象
- 视口像素坐标对象 `{ left, top, width, height }`



## 配置项

可直接传入 `createGenie({ … })`、调用 `genie.set({ … })` 进行增量更新，或作为 React / Vue / Svelte 组件的 `config` 属性传入。在 Svelte Action 中，也可以将这些配置与 `open` / `origin` 扁平写在同一个对象中。


| 参数名              | 必选            | 默认值          | 类型                      | 说明                                            |
| ---------------- | ------------- | ------------ | ----------------------- | --------------------------------------------- |
| `duration`       | 否             | `680`        | `number`                | 动画持续时长（毫秒）。                                   |
| `direction`      | 否             | `"auto"`     | `"auto"                 | "top"                                         |
| `slideEnd`       | 否             | `0.5`        | `number`（`0–1`）         | 近边剪切变形完成的时间节点。数值越小，漏斗口收拢得越早。                  |
| `translateStart` | 否             | `0.38`       | `number`（`0–1`）         | 网格整体开始滑向锚点的时间节点。与边缘剪切阶段重叠推进。                  |
| `easing`         | 否             | `"linear"`   | `"linear"               | "easeOut"                                     |
| `curve`          | 否             | `"inOut"`    | `"inOut"                | "in"                                          |
| `columns`        | 否             | `20`         | `number`                | WebGL 网格横向细分数量。数值越大曲线越平滑细腻，渲染开销也相应增加。         |
| `rows`           | 否             | `48`         | `number`                | WebGL 网格纵向细分数量。                               |
| `fadeStart`      | 否             | `0.88`       | `number`（`0–1`）         | 网格开始渐变淡出的时间节点（主要在收起动画末尾生效）。                   |
| `zIndex`         | 否             | `2147483000` | `number`                | 覆盖层 WebGL Canvas 的 CSS `z-index` 层级。          |
| `wireframe`      | 否             | `false`      | `boolean`               | 是否以线框模式渲染网格（用于调试与可视化形变过程）。                    |
| `reducedMotion`  | 否             | `"auto"`     | `boolean                | "auto"`                                       |
| `capture`        | 否             | 内置快照         | `(el) => Promise<canvas | image>`                                       |
| `open`           | 否（仅限 Vanilla） | 根据 CSS 自动推断  | `boolean`               | `createGenie` 的初始显隐状态。框架组件中请统一通过 `open` 属性控制。 |


`direction` 配置示例：

```js
{ direction: "auto" }    // 智能推断：根据相对几何位置自动选择 top / right / bottom / left
{ direction: "bottom" }  // 经典 macOS Dock 风格：向下收拢吸入
{ direction: "top" }     // 向上收拢吸入
{ direction: "left" }    // 向左收拢吸入
{ direction: "right" }   // 向右收拢吸入
```



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
await genie.hide();
genie.set({ duration: 400, origin: "#other-icon", direction: "bottom" });
genie.destroy();
```


| 方法            | 说明                                                   |
| ------------- | ---------------------------------------------------- |
| `show()`      | 展开目标（从锚点 `origin` 展开呼出至目标 `target`），返回 Promise。      |
| `hide()`      | 收起目标（从目标 `target` 变形收拢至锚点 `origin`），返回 Promise。      |
| `set(config)` | 增量更新配置项（包括 `origin`），在下一次执行 `show()` / `hide()` 时生效。 |
| `destroy()`   | 销毁实例，清理 WebGL Canvas 覆盖层并恢复目标元素状态。                   |




## React

必选属性：`open`、`origin`。可选属性：`config`、`className`、`style`。

```tsx
import { Genie } from "genie-web/react";

<Genie
  open={open}
  origin={iconRef}
  config={{ duration: 680, direction: "bottom" }}
>
  <div className="window">…</div>
</Genie>
```



## Vue

必选属性：`open`、`origin`。可选属性：`config`。组件上的其他属性（如 `class`、`style` 等）将自动透传至外层包裹的 `div` 容器。

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

