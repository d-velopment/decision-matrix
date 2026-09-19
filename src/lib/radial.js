export const TAU = Math.PI * 2;
const angle = value => ((value % TAU) + TAU) % TAU;

export function newControl(options, legacy = false) {
  return { x: 0, y: 0, arranged: false, legacy,
    angles: Object.fromEntries(options.map((option, i) => [option.id, -Math.PI / 2 + i * TAU / options.length])) };
}

export function clampPoint(x, y) {
  const magnitude = Math.hypot(x, y);
  const scale = magnitude > 1 ? 1 / magnitude : 1;
  return { x: x * scale, y: y * scale };
}

// Center = 50 for every option; touching an option = 100, the opposite edge = 0.
// The existing zero-floor and normalization are applied later by core.js.
export function radialRatings(control, options) {
  return Object.fromEntries(options.map(option => {
    const radians = control.angles[option.id];
    const distance = Math.hypot(Math.cos(radians) - control.x, Math.sin(radians) - control.y);
    return [option.id, Math.round(Math.max(0, Math.min(100, 100 * (1 - distance / 2))))];
  }));
}

export function syncControl(control, options) {
  const ids = new Set(options.map(option => option.id));
  for (const optionId of Object.keys(control.angles)) if (!ids.has(optionId)) delete control.angles[optionId];
  if (!control.arranged) {
    control.angles = newControl(options).angles;
    return;
  }
  for (const option of options) {
    if (Number.isFinite(control.angles[option.id])) continue;
    const existing = Object.values(control.angles).map(angle).sort((a, b) => a - b);
    if (!existing.length) { control.angles[option.id] = -Math.PI / 2; continue; }
    let largest = -1, next = 0;
    existing.forEach((a, i) => {
      const b = i === existing.length - 1 ? existing[0] + TAU : existing[i + 1];
      if (b - a > largest) { largest = b - a; next = a + largest / 2; }
    });
    control.angles[option.id] = angle(next);
  }
}

export function ensureControls(pair, options) {
  pair.controls ??= {};
  for (const pole of ['negative', 'positive']) {
    if (!pair.controls[pole]) pair.controls[pole] = newControl(options,
      options.some(option => pair.ratingsByOptionId[option.id]?.[`${pole}Raw`] !== 50));
    const control = pair.controls[pole];
    const topologyChanged = Object.keys(control.angles).length !== options.length || options.some(option => !(option.id in control.angles));
    if (topologyChanged && Math.hypot(control.x, control.y) > 0) control.legacy = true;
    syncControl(pair.controls[pole], options);
  }
}

export function moveControl(pair, options, pole, x, y) {
  ensureControls(pair, options);
  Object.assign(pair.controls[pole], clampPoint(x, y), { legacy: false });
  const ratings = radialRatings(pair.controls[pole], options);
  for (const option of options) pair.ratingsByOptionId[option.id][`${pole}Raw`] = ratings[option.id];
}

export function moveOption(pair, options, pole, optionId, radians) {
  ensureControls(pair, options);
  pair.controls[pole].angles[optionId] = angle(radians);
  pair.controls[pole].arranged = true;
  moveControl(pair, options, pole, pair.controls[pole].x, pair.controls[pole].y);
}

export function validControls(controls, options) {
  return controls === undefined || ['negative', 'positive'].every(pole => {
    const c = controls[pole];
    return c && Number.isFinite(c.x) && Number.isFinite(c.y) && Math.hypot(c.x, c.y) <= 1.000001 &&
      typeof c.arranged === 'boolean' && typeof c.legacy === 'boolean' && c.angles &&
      options.every(option => Number.isFinite(c.angles[option.id]));
  });
}
