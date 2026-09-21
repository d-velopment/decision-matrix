<script>
  /**
   * Inline SVG icon component backed by a small named path catalog.
   *
   * Imported by: App.svelte and Results.svelte.
   * Used for navigation, status, action, and decorative icons.
   */

  let { name, size = 20 } = $props();
  const paths = {
    arrow: 'M4 12h15m-6-6 6 6-6 6',
    back: 'M20 12H5m6-6-6 6 6 6',
    plus: 'M12 5v14M5 12h14',
    close: 'm6 6 12 12M18 6 6 18',
    check: 'm5 12 4 4L19 6',
    reset: 'M3 10a9 9 0 1 1 2 8M3 4v6h6',
    spark: 'm12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3Z',
    down: 'm6 9 6 6 6-6',
    shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
  };
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"><path d={paths[name] || paths.spark} /></svg
>
