import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState,
  addOption,
  addPair,
  removeOption,
  removePair,
  canCalculate,
  mergeSuggestions,
  loadState,
  saveState,
  isValidState,
} from '../src/lib/state.js';
import { normalize } from '../src/lib/core.js';
test('editing and deletion preserve raw values and additions start at midpoint', () => {
  const state = createState();
  const a = addOption(state, 'A');
  const b = addOption(state, 'B');
  const p = addPair(state, 'No', 'Yes');
  p.importanceRaw = 80;
  p.ratingsByOptionId[a.id].negativeRaw = 0;
  a.label = 'Renamed';
  const q = addPair(state, 'Down', 'Up');
  assert.equal(p.importanceRaw, 80);
  assert.equal(q.importanceRaw, 50);
  assert.ok(normalize(state.pairs.map((p) => p.importanceRaw))[0] < 100);
  const c = addOption(state, 'C');
  assert.equal(p.ratingsByOptionId[c.id].negativeRaw, 50);
  removeOption(state, b.id);
  removePair(state, q.id);
  assert.equal(p.ratingsByOptionId[a.id].negativeRaw, 0);
  assert.equal(p.importanceRaw, 80);
  assert.equal(canCalculate(state), true);
  removeOption(state, c.id);
  assert.equal(canCalculate(state), false);
});
test('hard caps and complete labels are enforced', () => {
  const state = createState();
  for (let i = 0; i < 8; i++) addOption(state, `Option ${i}`);
  for (let i = 0; i < 35; i++) addPair(state, `Negative ${i}`, `Positive ${i}`);
  assert.equal(state.options.length, 6);
  assert.equal(state.pairs.length, 30);
  assert.equal(canCalculate(state), true);
  state.pairs[0].negativeLabel = ' ';
  assert.equal(canCalculate(state), false);
});
test('late suggestions cannot overwrite edits, revive deleted items, or cross resets', () => {
  const state = createState();
  const a = addOption(state, 'A');
  addOption(state, 'B');
  removeOption(state, a.id);
  const response = { options: ['A', 'B', 'C'], pairs: [{ negativeLabel: 'No', positiveLabel: 'Yes' }] };
  const before = structuredClone(state.options);
  mergeSuggestions(state, response, state.id);
  assert.deepEqual(state.options, before);
  assert.deepEqual(state.suggestions.options, ['C']);
  const reset = createState();
  assert.equal(mergeSuggestions(reset, response, state.id), false);
  assert.deepEqual(reset.suggestions.options, []);
});
test('local persistence restores raw values and rejects malformed state', () => {
  let saved = null;
  const storage = {
    getItem: () => saved,
    setItem: (_, v) => {
      saved = v;
    },
  };
  const state = createState();
  addOption(state, 'A');
  addOption(state, 'B');
  const p = addPair(state, 'No', 'Yes');
  p.importanceRaw = 0;
  state.currentStep = 'evaluate';
  assert.equal(saveState(storage, state), true);
  assert.deepEqual(loadState(storage), state);
  assert.equal(isValidState({}), false);
  saved = '{broken';
  assert.equal(loadState(storage).options.length, 0);
  assert.equal(
    saveState(
      {
        setItem() {
          throw new Error('full');
        },
      },
      state,
    ),
    false,
  );
});
