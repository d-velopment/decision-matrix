import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateMetrics, calculateNormalized, calculateDecision, normalize, podium, percentage, METRICS } from '../src/lib/core.js';
import { createState, addOption, addPair } from '../src/lib/state.js';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/excel.json', import.meta.url)));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('all 28 legacy metrics reproduce cached Excel values without new input rules', () => {
  const results = calculateNormalized(fixture.pairs.map(p => p.weight), fixture.pairs.map(p => p.negative), fixture.pairs.map(p => p.positive));
  results.forEach((result, i) => METRICS.forEach(metric => near(result[metric], fixture.expected[i][metric])));
  near(results.reduce((sum, r) => sum + r.balance, 0), 0);
});
test('hidden normalization floors zeros without mutating raw inputs', () => {
  const raw = [100, 0, 0, 0];
  const result = normalize(raw);
  assert.deepEqual(raw, [100, 0, 0, 0]);
  result.forEach((v, i) => near(v, (i === 0 ? 100 : 1) / 103 * 100));
  near(result.reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(normalize([0, 0]), [50, 50]);
  assert.deepEqual(normalize([50, 50]), [50, 50]);
});
test('undefined metrics display dashes but downstream formulas use 0.5', () => {
  const zero = calculateMetrics([0, 0]);
  assert.equal(zero.uncertainty, null); assert.equal(zero.calm, null);
  assert.equal(zero.result, 0); assert.equal(zero.interest, 0);
  const partial = calculateMetrics([0, 2]);
  assert.equal(partial.uncertainty, null); assert.equal(partial.calm, -0.5);
  assert.equal(partial.interest, 4); assert.equal(partial.result, 4);
  assert.equal(percentage(null), '—'); assert.equal(percentage(0.5123), '51.23%');
});
test('untouched ratings and one-pair decisions produce finite results', () => {
  const state = createState(); addOption(state, 'A'); addOption(state, 'B'); addPair(state, 'Negative', 'Positive');
  const result = calculateDecision(state);
  assert.deepEqual(result.map(r => r.result), [0, 0]);
  assert.equal(podium(result)[0].options.length, 2);
  state.pairs[0].ratingsByOptionId[state.options[0].id].positiveRaw = 100;
  calculateDecision(state).forEach(r => assert.ok(Number.isFinite(r.result)));
});
test('podium filters before rounding, ranks densely, and uses unrounded flame threshold', () => {
  const ranks = podium([-0.004, 0.51231, 0.51234, 0.4, 0, 1.004].map((result, id) => ({ id, result })));
  assert.deepEqual(ranks.map(r => r.options.map(o => o.id)), [[5], [1, 2], [3]]);
  assert.equal(ranks[0].options[0].flame, true);
  assert.equal(ranks[0].options[0].score, 100);
  assert.equal(podium([{ result: 1 }])[0].options[0].flame, false);
  assert.equal(podium([{ result: 0 }])[0].options.length, 1);
  assert.deepEqual(podium([{ result: -1 }]).map(r => r.options), [[], [], []]);
});
test('production normalization is deliberately separate from Excel parity', () => {
  const results = calculateNormalized(normalize(fixture.pairs.map(p => p.weight)), fixture.pairs.map(p => normalize(p.negative)), fixture.pairs.map(p => normalize(p.positive)));
  assert.notEqual(results[0].result, fixture.expected[0].result);
  near(results.reduce((sum, r) => sum + r.balance, 0), 0);
});
