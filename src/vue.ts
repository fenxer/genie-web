import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import { createGenie, type GenieInstance } from "./genie";
import type { GenieConfig, OriginInput } from "./types";

export const Genie = defineComponent({
  name: "Genie",
  props: {
    open: { type: Boolean, required: true },
    origin: { type: [Object, String] as PropType<OriginInput>, required: true },
    config: { type: Object as PropType<GenieConfig>, default: () => ({}) }
  },
  setup(props, { slots, attrs }) {
    const root = ref<HTMLElement | null>(null);
    let api: GenieInstance | null = null;
    let ready = false;

    onMounted(() => {
      if (!root.value) return;
      api = createGenie({
        target: root.value,
        origin: props.origin,
        open: props.open,
        ...props.config
      });
      ready = true;
    });

    watch(
      () => props.config,
      (config) => api?.set({ origin: props.origin, ...config }),
      { deep: true }
    );

    watch(
      () => props.origin,
      (origin) => api?.set({ origin })
    );

    watch(
      () => props.open,
      (open) => {
        if (!ready || !api) return;
        void (open ? api.show() : api.hide());
      }
    );

    onBeforeUnmount(() => {
      api?.destroy();
      api = null;
    });

    return () => h("div", { ref: root, ...attrs }, slots.default?.());
  }
});

export { createGenie, defaults } from "./index";
export type {
  CaptureConfig,
  GenieConfig,
  GenieInstance,
  GeniePlayOptions,
  OriginInput,
  SnapshotMode
} from "./index";
