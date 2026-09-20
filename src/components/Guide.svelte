<script>
  let { message, compact = false } = $props();
</script>

<aside class:compact class="guide-card" aria-label="Your guide">
  <img src="/guide/companion.png" alt="" />
  <div class="guide-copy">
    <span class="guide-label">YOUR GUIDE</span>
    <p>{message}</p>
  </div>
</aside>
