/**
 * Geometry helpers shared by radial controls and pointer interactions.
 * The functions wrap angles and constrain points without touching application state.
 *
 * Imported by: src/lib/radial.js.
 */

export const TAU = Math.PI * 2;

/** Wrap an angle into the [0, 2π) interval. */
export const angle = (value) => ((value % TAU) + TAU) % TAU;

/** Clamp a point to the unit circle while preserving its direction. */
export function clampPoint(x, y) {
  const magnitude = Math.hypot(x, y);
  const scale = magnitude > 1 ? 1 / magnitude : 1;
  return { x: x * scale, y: y * scale };
}
