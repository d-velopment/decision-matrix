import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newControl, radialRatings, clampPoint, moveControl, moveOption } from '../src/lib/radial.js';
import {
  createState,
  addOption,
  addPair,
  loadState,
  saveState,
  addMentionedOptions,
  removeOption,
} from '../src/lib/state.js';
import { normalize, calculateDecision } from '../src/lib/core.js';
import { extractOptions } from '../src/lib/extract-options.js';

/** Create a decision fixture with a configurable number of options. */
function decision(n = 3) {
  const state = createState();
  for (let i = 0; i < n; i++) addOption(state, `Option ${i}`);
  addPair(state, 'Negative', 'Positive');
  return state;
}
test('center produces equal ratings for 2–6 options regardless of angular arrangement', () => {
  for (let n = 2; n <= 6; n++) {
    const state = decision(n);
    const pair = state.pairs[0];
    moveOption(pair, state.options, 'negative', state.options[0].id, 1.123);
    assert.deepEqual(Object.values(radialRatings(pair.controls.negative, state.options)), Array(n).fill(50));
    calculateDecision(state).forEach((result) => assert.equal(result.result, 0));
  }
});
test('distance increases preference, clamp stays in the circle, and zero floor remains separate', () => {
  const options = [{ id: 'a' }, { id: 'b' }];
  const control = newControl(options);
  control.x = 0;
  control.y = -1;
  assert.deepEqual(radialRatings(control, options), { a: 100, b: 0 });
  assert.deepEqual(normalize(Object.values(radialRatings(control, options))), [10000 / 101, 100 / 101]);
  const point = clampPoint(3, 4);
  assert.equal(Math.hypot(point.x, point.y), 1);
  control.y = -0.3;
  const ratings = radialRatings(control, options);
  assert.ok(ratings.a > ratings.b);
});
test('negative/positive positions are independent, and rotating an option changes its distance', () => {
  const state = decision(2);
  const pair = state.pairs[0];
  moveControl(pair, state.options, 'negative', 0, -0.8);
  const positive = structuredClone(pair.controls.positive);
  const before = pair.ratingsByOptionId[state.options[0].id].negativeRaw;
  moveOption(pair, state.options, 'negative', state.options[0].id, Math.PI / 2);
  assert.ok(pair.ratingsByOptionId[state.options[0].id].negativeRaw < before);
  assert.deepEqual(pair.controls.positive, positive);
  assert.equal(pair.ratingsByOptionId[state.options[0].id].positiveRaw, 50);
});
test('positions and ratings survive reload; old slider states migrate without losing values', () => {
  const state = decision();
  const pair = state.pairs[0];
  moveControl(pair, state.options, 'positive', 0.4, -0.2);
  moveOption(pair, state.options, 'positive', state.options[0].id, 0.6);
  let saved;
  const storage = {
    setItem: (_, data) => {
      saved = data;
    },
    getItem: () => saved,
  };
  saveState(storage, state);
  assert.deepEqual(loadState(storage), state);
  delete pair.controls;
  pair.ratingsByOptionId[state.options[0].id].negativeRaw = 14;
  saveState(storage, state);
  const migrated = loadState(storage);
  assert.equal(migrated.pairs[0].ratingsByOptionId[state.options[0].id].negativeRaw, 14);
  assert.equal(migrated.pairs[0].controls.negative.legacy, true);
});
test('description extracts explicit English/Russian lists, not feelings or unrelated prose', () => {
  assert.deepEqual(extractOptions('I am choosing between London, Tallinn and Riga.'), ['London', 'Tallinn', 'Riga']);
  assert.deepEqual(extractOptions('Выбираю между Москвой, Таллином и Лондоном.'), ['Москвой', 'Таллином', 'Лондоном']);
  assert.deepEqual(extractOptions('Варианты: Москва, Таллин, Лондон'), ['Москва', 'Таллин', 'Лондон']);
  assert.deepEqual(extractOptions('I need to decide whether to stay or move.'), ['stay', 'move']);
  assert.deepEqual(extractOptions('My possibilities:\n- Stay\n- Move'), ['Stay', 'Move']);
  assert.deepEqual(extractOptions('I feel anxious and want to talk.'), []);
  assert.deepEqual(extractOptions('Я рассматриваю Москву, Ригу, Лондон.'), ['Москву', 'Ригу', 'Лондон']);
});
test('auto-added mentions honor duplicates, deletion, and the option cap', () => {
  const state = createState();
  addMentionedOptions(state, ['London', 'Riga']);
  addMentionedOptions(state, ['london', 'Riga']);
  assert.equal(state.options.length, 2);
  removeOption(state, state.options[0].id);
  addMentionedOptions(state, ['London']);
  assert.equal(state.options.length, 1);
  addMentionedOptions(state, ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.equal(state.options.length, 6);
});

test('renaming an auto-added option does not re-add its old name from the description', () => {
  const state = createState();
  addMentionedOptions(state, ['London', 'Riga']);
  state.options[0].label = 'Berlin';
  addMentionedOptions(state, ['London', 'Riga']);
  assert.deepEqual(
    state.options.map((option) => option.label),
    ['Berlin', 'Riga'],
  );
});
