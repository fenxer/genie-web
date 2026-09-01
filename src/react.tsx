import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createGenie, type GenieInstance } from "./genie";
import type { GenieConfig, OriginInput } from "./types";

type Props = {
  open: boolean;
  origin: OriginInput;
  config?: GenieConfig;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export function Genie({ open, origin, config, className, style, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const api = useRef<GenieInstance | null>(null);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    const instance = createGenie({
      target,
      origin,
      open,
      ...config
    });
    api.current = instance;
    return () => {
      instance.destroy();
      api.current = null;
    };
    // origin/config updates go through set()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.current?.set({ origin, ...config });
  }, [origin, config]);

  useEffect(() => {
    if (!api.current) return;
    if (open) void api.current.show();
    else void api.current.hide();
  }, [open]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
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
