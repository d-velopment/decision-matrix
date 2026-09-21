/**
 * Public barrel for the project's pure utility functions.
 * It provides one import surface for text, numeric, geometric, and validation helpers.
 *
 * Imported by: future consumers that prefer the consolidated utils entry point.
 */

export { key, pairKey } from './text.js';
export { normalize, percentage } from './numbers.js';
export { TAU, angle, clampPoint } from './math.js';
export { isBoundedInteger, isText } from './validation.js';
