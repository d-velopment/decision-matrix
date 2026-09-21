/**
 * Small reusable validators for persisted percentage and text fields.
 * These helpers contain no browser or Svelte dependencies.
 *
 * Imported by: src/lib/state.js.
 */

/** Check whether a value is an integer percentage in the accepted raw-input range. */
export const isBoundedInteger = (value) => Number.isInteger(value) && value >= 0 && value <= 100;

/** Check whether a value is text no longer than the supplied limit. */
export const isText = (value, max) => typeof value === 'string' && value.length <= max;
