<script>
  /**
   * Small illustrated guide card that pairs the companion image with a short
   * contextual message.
   *
   * Imported by: Results.svelte.
   * App.svelte currently provides the larger guide scene directly in its markup.
   */

  let { message, compact = false } = $props();
</script>

<aside class:compact class="guide-card" aria-label="Your guide">
  <img src="/guide/companion.png" alt="" />
  <div class="guide-copy">
    <span class="guide-label">YOUR GUIDE</span>
    <p>{message}</p>
  </div>
</aside>
