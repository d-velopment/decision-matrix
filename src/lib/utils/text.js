/**
 * Text normalization helpers for comparing user-entered options and pairs.
 * These functions provide stable, case-insensitive keys without mutating input.
 *
 * Imported by: src/lib/state.js and src/App.svelte.
 */

/** Normalize a label for case-insensitive, whitespace-insensitive comparisons. */
export const key = (text) => text.trim().toLocaleLowerCase().replace(/\s+/g, ' ');

/** Build a stable comparison key for a negative/positive pair. */
export const pairKey = (pair) => `${key(pair.negativeLabel)}|${key(pair.positiveLabel)}`;
