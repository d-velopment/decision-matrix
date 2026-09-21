/**
 * Pure numeric helpers for hidden rating normalization and display formatting.
 * They keep calculation rules independent from Svelte components and state.
 *
 * Imported by: src/lib/core.js and calculation tests.
 */

/** Normalize finite ratings to a 100-point distribution with a hidden minimum of one. */
export function normalize(values) {
  if (!values.length || !values.every(Number.isFinite)) throw new TypeError('Expected finite inputs');
  const bounded = values.map((value) => Math.min(100, Math.max(1, value)));
  const total = bounded.reduce((sum, value) => sum + value, 0);
  return bounded.map((value) => (100 * value) / total);
}

/** Format a normalized metric as a percentage or an em dash for unavailable data. */
export function percentage(value) {
  return value === null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(2)}%`;
}
