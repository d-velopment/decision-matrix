<script>
  /**
   * Interactive radial control for positioning options around a negative or
   * positive experience.
   *
   * Imported by: App.svelte on the Weigh it up page.
   * Reports pointer and keyboard changes through onmove and onrotate props.
   */

  import { clampPoint } from '../lib/radial.js';
  let { options, control, label, tone = 'positive', onmove, onrotate } = $props();
  let stage;
  let dragging = $state(null);
  const nearest = $derived.by(() => {
    if (Math.hypot(control.x, control.y) < 0.025) return null;
    return [...options].sort(
      (a, b) =>
        Math.hypot(Math.cos(control.angles[a.id]) - control.x, Math.sin(control.angles[a.id]) - control.y) -
        Math.hypot(Math.cos(control.angles[b.id]) - control.x, Math.sin(control.angles[b.id]) - control.y),
    )[0];
  });

  /** Convert a pointer event into coordinates relative to the radial stage. */
  function position(event) {
    const box = stage.getBoundingClientRect();
    return {
      x: (event.clientX - box.left - box.width / 2) / (box.width * 0.32),
      y: (event.clientY - box.top - box.height / 2) / (box.height * 0.32),
    };
  }

  /** Begin dragging the center joystick or an individual option marker. */
  function start(event, optionId = null) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging = { optionId, pointerId: event.pointerId };
  }

  /** Apply a pointer movement to the active control or rotating option. */
  function move(event) {
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    const point = position(event);
    if (dragging.optionId) {
      if (Math.hypot(point.x, point.y) > 0.1) onrotate(dragging.optionId, Math.atan2(point.y, point.x));
    } else {
      const next = clampPoint(point.x, point.y);
      onmove(next.x, next.y);
    }
  }

  /** End a pointer drag and release its capture. */
  function stop(event) {
    if (dragging?.pointerId !== event.pointerId) return;
    dragging = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  /** Move the center control with keyboard arrows or reset it with Home. */
  function keyMove(event) {
    const steps = { ArrowLeft: [-0.08, 0], ArrowRight: [0.08, 0], ArrowUp: [0, -0.08], ArrowDown: [0, 0.08] };
    if (event.key === 'Home') {
      event.preventDefault();
      onmove(0, 0);
      return;
    }
    if (!steps[event.key]) return;
    event.preventDefault();
    const [dx, dy] = steps[event.key];
    const next = clampPoint(control.x + dx, control.y + dy);
    onmove(next.x, next.y);
  }

  /** Rotate an option marker with keyboard arrows. */
  function keyRotate(event, optionId) {
    const directions = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };
    if (!directions[event.key]) return;
    event.preventDefault();
    onrotate(optionId, control.angles[optionId] + (directions[event.key] * Math.PI) / 18);
  }
</script>

<div class="radial-control {tone}" class:dragging={dragging !== null}>
  <p class="radial-instruction">Move the center toward an option.</p>
  <div class="radial-stage" bind:this={stage}>
    <svg class="radial-guide" viewBox="0 0 400 400" aria-hidden="true">
      <circle class="radial-wash" cx="200" cy="200" r="128" />
      <circle class="radial-inner" cx="200" cy="200" r="72" />
      <path class="radial-cross" d="M200 63v274M63 200h274" />
      {#each options as option (option.id)}
        <line
          class="radial-thread"
          x1={200 + control.x * 128}
          y1={200 + control.y * 128}
          x2={200 + Math.cos(control.angles[option.id]) * 128}
          y2={200 + Math.sin(control.angles[option.id]) * 128}
        />
      {/each}
      <circle class="radial-origin" cx="200" cy="200" r="3" />
    </svg>
    {#each options as option, index (option.id)}
      <button
        class="radial-option"
        class:nearest={nearest?.id === option.id}
        class:held={dragging?.optionId === option.id}
        style:left={`${50 + Math.cos(control.angles[option.id]) * 32}%`}
        style:top={`${50 + Math.sin(control.angles[option.id]) * 32}%`}
        aria-label={`Reposition ${option.label} for ${label}`}
        title={`${option.label} — drag around the circle, or use arrow keys`}
        onpointerdown={(event) => start(event, option.id)}
        onpointermove={move}
        onpointerup={stop}
        onpointercancel={stop}
        onlostpointercapture={() => {
          dragging = null;
        }}
        onkeydown={(event) => keyRotate(event, option.id)}
      >
        <span class="radial-option-top"
          ><span>{String.fromCharCode(65 + index)}</span><span class="drag-grip" aria-hidden="true">⠿</span></span
        >
        <span class="radial-option-label" dir="auto">{option.label}</span>
      </button>
    {/each}
    <button
      class="radial-puck"
      class:held={dragging !== null && !dragging.optionId}
      style:left={`${50 + control.x * 32}%`}
      style:top={`${50 + control.y * 32}%`}
      aria-label={`Move preference for ${label}`}
      aria-describedby={`hint-${tone}`}
      title="Drag to move. Arrow keys also work; Home returns to center."
      onpointerdown={(event) => start(event)}
      onpointermove={move}
      onpointerup={stop}
      onpointercancel={stop}
      onlostpointercapture={() => {
        dragging = null;
      }}
      onkeydown={keyMove}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        aria-hidden="true"><path d="M12 3v18M3 12h18m-12-6 3-3 3 3M6 9l-3 3 3 3m12-6 3 3-3 3m-9 3 3 3 3-3" /></svg
      >
    </button>
  </div>
  <div class="radial-caption">
    <span class="drag-grip" aria-hidden="true">⠿</span><span id={`hint-${tone}`}
      >Drag the labels around the circle.<br /><span class="keyboard-hint">Or focus a control and use arrow keys.</span
      ></span
    >
  </div>
  <div class="radial-status">
    <span
      >{control.legacy
        ? 'Previous ratings kept until you move.'
        : nearest
          ? `Closer to ${nearest.label}`
          : 'Centered · all options equal'}</span
    ><button class="text-button" onclick={() => onmove(0, 0)}>Center</button>
  </div>
</div>
