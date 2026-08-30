import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    react: "src/react.tsx",
    vue: "src/vue.ts",
    svelte: "src/svelte.ts"
  },
  format: ["esm"],
  dts: true,
  clean: true,
  external: ["react", "react-dom", "vue", "svelte"]
});
