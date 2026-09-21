<script>
  /**
   * Results presentation component that normalizes metric columns, builds the
   * three-place podium, and exposes the expandable metrics table.
   *
   * Imported by: App.svelte.
   * Imports: Guide and Icon for the illustrated result layout.
   */

  import { METRICS, podium, percentage, normalizeResults } from '../lib/core.js';
  import Icon from './Icon.svelte';
  import Guide from './Guide.svelte';
  let { results, onedit } = $props();
  const displayResults = $derived(normalizeResults(results));
  const ranks = $derived(podium(displayResults));
  const hasOptions = $derived(ranks[0].options.length > 0);
</script>

<section class="results-view">
  <div class="center-heading">
    <Guide compact message="You’ve made the decision yours. Now see what rises to the top." />
    <div class="center-heading-copy">
      <div class="eyebrow"><span class="tiny-dot"></span> YOUR PERSPECTIVE, MADE CLEAR</div>
      <h1>{hasOptions ? 'Your way forward.' : 'No options'}</h1>
      <p>
        {hasOptions
          ? 'Here’s how your options line up with what matters to you.'
          : 'Add options and ratings to see your results.'}
      </p>
    </div>
  </div>
  <div class="podium" aria-label="Decision podium">
    {#each [ranks[1], ranks[0], ranks[2]] as rank (rank.place)}
      <section class="podium-place place-{rank.place}" aria-label={`Place ${rank.place}`}>
        <div class="podium-options">
          {#each rank.options as option (option.id)}
            <div class="podium-option">
              {#if rank.place === 1}<span class="top-label">BEST MATCH</span>{/if}
              <h2 dir="auto">{option.label}</h2>
              <span class="score">{option.score}%</span>
            </div>
          {:else}<span class="empty-place" aria-label="Unoccupied">—</span>{/each}
        </div>
        <div class="podium-block">
          <span class="place-number">0{rank.place}</span><span
            >{['FIRST PLACE', 'SECOND PLACE', 'THIRD PLACE'][rank.place - 1]}</span
          >
        </div>
      </section>
    {/each}
  </div>
  <div class="result-actions">
    <button class="button secondary" onclick={onedit}><Icon name="back" /> Revisit your ratings</button>
  </div>
  <details class="result-details">
    <summary
      ><span><Icon name="plus" /> Explore the numbers</span><span class="muted">All options & metrics</span></summary
    >
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users must be able to scroll the wide results table.) -->
    <div class="table-scroll" tabindex="0" role="region" aria-label="All results">
      <table>
        <thead
          ><tr
            ><th scope="col">Option</th>{#each METRICS as metric (metric)}<th scope="col"
                >{metric[0].toUpperCase() + metric.slice(1)}</th
              >{/each}</tr
          ></thead
        >
        <tbody
          >{#each displayResults as option (option.id)}<tr
              ><th scope="row" dir="auto">{option.label}</th>{#each METRICS as metric (metric)}<td
                  class:result-cell={metric === 'result'}>{percentage(option[metric])}</td
                >{/each}</tr
            >{/each}</tbody
        >
      </table>
    </div>
    <p class="table-note">
      Each column is scaled between outward-rounded bounds, with the lowest shown as 0% and highest as 100%. Constant
      columns show 50%; undefined values show a dash. Places use whole percentages.
    </p>
  </details>
</section>
