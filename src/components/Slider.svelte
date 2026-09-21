<script>
  /**
   * Verbal range-slider component for importance and emotional ratings.
   *
   * Imported by: App.svelte.
   * Reports numeric changes through onchange and renders a human-readable label.
   */

  let { value = 50, label, importance = false, tone = 'green', onchange = () => {} } = $props();
  const verbal = $derived(
    value === 0
      ? importance
        ? 'Not important'
        : 'Not at all'
      : value < 35
        ? 'A little'
        : value < 65
          ? 'Moderately'
          : value < 100
            ? 'Quite a lot'
            : importance
              ? 'Very important'
              : 'Very much',
  );
</script>

<div class="slider" class:rose={tone === 'rose'}>
  <input
    type="range"
    min="0"
    max="100"
    step="1"
    {value}
    aria-label={label}
    aria-valuetext={verbal}
    oninput={(event) => onchange(Number(event.currentTarget.value))}
  />
  <div class="slider-ends">
    <span>{importance ? 'Not important' : 'Not at all'}</span><span>{importance ? 'Very important' : 'Very much'}</span>
  </div>
</div>
