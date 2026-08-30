<script>
  import { onMount } from "svelte";
  import { createGenie } from "genie-web";

  export let open = false;
  export let origin;
  export let config = {};

  let root;
  let api;
  let ready = false;

  onMount(() => {
    api = createGenie({
      target: root,
      origin,
      open,
      ...config
    });
    ready = true;
    return () => api.destroy();
  });

  $: if (api) api.set({ origin, ...config });
  $: if (ready && api) open ? api.show() : api.hide();
</script>

<div bind:this={root} {...$$restProps}>
  <slot />
</div>
