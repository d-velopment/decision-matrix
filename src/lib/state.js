/**
 * Decision-state lifecycle helpers for options, pairs, suggestions, persistence, and validation.
 * Mutating operations are kept here so the Svelte root component can stay focused on UI flow.
 *
 * Imported by: src/App.svelte and state/core/radial tests.
 */

import { ensureControls, validControls } from './radial.js';
import { key, pairKey } from './utils/text.js';
import { isBoundedInteger, isText } from './utils/validation.js';

export { key, pairKey };

export const STORAGE_KEY = 'decision-matrix:v1';
export const MAX_OPTIONS = 6;
export const MAX_PAIRS = 30;

/** Generate a unique identifier for a new local entity. */
const id = () => crypto.randomUUID();

/** Create a new empty decision document with safe defaults. */
export function createState() {
  return {
    schemaVersion: 1,
    id: id(),
    description: '',
    messages: [],
    options: [],
    pairs: [],
    suggestions: { options: [], pairs: [] },
    dismissed: { options: [], pairs: [] },
    recognizedOptions: [],
    currentStep: 'prepare',
    preparePage: 'mind',
    currentPairId: null,
    inputRevision: 0,
    lastCalculatedRevision: null,
  };
}

/** Mark the state as changed so persistence and result invalidation can react. */
export function touch(state) {
  state.inputRevision++;
}

/** Add an option and initialize its ratings in every existing pair. */
export function addOption(state, label = '') {
  if (state.options.length >= MAX_OPTIONS) return null;
  const option = { id: id(), label };
  state.options.push(option);
  for (const pair of state.pairs) {
    pair.ratingsByOptionId[option.id] = { negativeRaw: 50, positiveRaw: 50 };
    ensureControls(pair, state.options);
  }
  touch(state);
  return option;
}

/** Add a negative/positive pair with midpoint ratings for every option. */
export function addPair(state, negativeLabel = '', positiveLabel = '') {
  if (state.pairs.length >= MAX_PAIRS) return null;
  const pair = {
    id: id(),
    negativeLabel,
    positiveLabel,
    importanceRaw: 50,
    ratingsByOptionId: Object.fromEntries(
      state.options.map((option) => [option.id, { negativeRaw: 50, positiveRaw: 50 }]),
    ),
  };
  state.pairs.push(pair);
  ensureControls(pair, state.options);
  state.currentPairId ??= pair.id;
  touch(state);
  return pair;
}

/** Remove an option, preserve its dismissal, and repair pair controls. */
export function removeOption(state, optionId) {
  const item = state.options.find((option) => option.id === optionId);
  if (!item) return;
  state.dismissed.options.push(key(item.label));
  state.options = state.options.filter((option) => option.id !== optionId);
  for (const pair of state.pairs) {
    delete pair.ratingsByOptionId[optionId];
    ensureControls(pair, state.options);
  }
  touch(state);
}

/** Remove a pair and select a remaining pair when necessary. */
export function removePair(state, pairId) {
  const item = state.pairs.find((pair) => pair.id === pairId);
  if (!item) return;
  state.dismissed.pairs.push(pairKey(item));
  state.pairs = state.pairs.filter((pair) => pair.id !== pairId);
  if (state.currentPairId === pairId) state.currentPairId = state.pairs[0]?.id ?? null;
  touch(state);
}

/** Determine whether the decision has enough complete input to calculate. */
export function canCalculate(state) {
  return (
    state.options.length >= 2 &&
    state.options.length <= MAX_OPTIONS &&
    state.pairs.length >= 1 &&
    state.pairs.length <= MAX_PAIRS &&
    state.options.every((option) => option.label.trim()) &&
    state.pairs.every((pair) => pair.negativeLabel.trim() && pair.positiveLabel.trim())
  );
}

/** Add explicitly recognized options while respecting caps and dismissals. */
export function addMentionedOptions(state, labels) {
  state.recognizedOptions ??= [];
  const seen = new Set([
    ...state.options.map((option) => key(option.label)),
    ...state.dismissed.options,
    ...state.recognizedOptions,
  ]);
  for (const label of labels) {
    if (typeof label !== 'string' || !label.trim() || label.length > 160) continue;
    if (seen.has(key(label))) {
      if (!state.recognizedOptions.includes(key(label))) state.recognizedOptions.push(key(label));
      continue;
    }
    if (!addOption(state, label.trim())) break;
    seen.add(key(label));
    state.recognizedOptions.push(key(label));
  }
  state.suggestions.options = state.suggestions.options.filter((label) => !seen.has(key(label)));
}

// Suggestions are merged into a separate inbox, never directly into accepted inputs.

/** Merge only new AI suggestions into the current decision inbox. */
export function mergeSuggestions(state, response, requestedDecisionId) {
  if (state.id !== requestedDecisionId) return false;
  const optionKeys = new Set([
    ...state.options.map((option) => key(option.label)),
    ...state.suggestions.options.map(key),
    ...state.dismissed.options,
  ]);
  for (const label of response.options)
    if (!optionKeys.has(key(label))) {
      state.suggestions.options.push(label);
      optionKeys.add(key(label));
    }
  state.suggestions.options = state.suggestions.options.slice(0, MAX_OPTIONS - state.options.length);
  const pairKeys = new Set([
    ...state.pairs.map(pairKey),
    ...state.suggestions.pairs.map(pairKey),
    ...state.dismissed.pairs,
  ]);
  for (const pair of response.pairs)
    if (!pairKeys.has(pairKey(pair))) {
      state.suggestions.pairs.push(pair);
      pairKeys.add(pairKey(pair));
    }
  state.suggestions.pairs = state.suggestions.pairs.slice(0, MAX_PAIRS - state.pairs.length);
  return true;
}

/** Validate persisted state before it is restored into the application. */
export function isValidState(state) {
  try {
    if (
      state.schemaVersion !== 1 ||
      !isText(state.id, 100) ||
      !isText(state.description, 6000) ||
      !Array.isArray(state.options) ||
      state.options.length > MAX_OPTIONS ||
      !Array.isArray(state.pairs) ||
      state.pairs.length > MAX_PAIRS
    )
      return false;
    if (!state.options.every((option) => isText(option.id, 100) && isText(option.label, 160))) return false;
    if (
      state.recognizedOptions !== undefined &&
      (!Array.isArray(state.recognizedOptions) || !state.recognizedOptions.every((label) => isText(label, 160)))
    )
      return false;
    if (new Set(state.options.map((option) => option.id)).size !== state.options.length) return false;
    if (new Set(state.pairs.map((pair) => pair.id)).size !== state.pairs.length) return false;
    if (
      !state.pairs.every(
        (pair) =>
          isText(pair.id, 100) &&
          isText(pair.negativeLabel, 160) &&
          isText(pair.positiveLabel, 160) &&
          isBoundedInteger(pair.importanceRaw) &&
          validControls(pair.controls, state.options) &&
          state.options.every(
            (option) =>
              isBoundedInteger(pair.ratingsByOptionId[option.id].negativeRaw) &&
              isBoundedInteger(pair.ratingsByOptionId[option.id].positiveRaw),
          ),
      )
    )
      return false;
    if (
      !['prepare', 'evaluate', 'results'].includes(state.currentStep) ||
      !['mind', 'options', 'criteria'].includes(state.preparePage ?? 'mind') ||
      !Number.isInteger(state.inputRevision) ||
      state.inputRevision < 0
    )
      return false;
    if (state.lastCalculatedRevision !== null && !Number.isInteger(state.lastCalculatedRevision)) return false;
    if (
      !Array.isArray(state.messages) ||
      state.messages.length > 100 ||
      !state.messages.every((message) => ['user', 'assistant'].includes(message.role) && isText(message.content, 6000))
    )
      return false;
    if (
      !Array.isArray(state.suggestions.options) ||
      state.suggestions.options.length > MAX_OPTIONS ||
      !state.suggestions.options.every((label) => isText(label, 160))
    )
      return false;
    if (
      !Array.isArray(state.suggestions.pairs) ||
      state.suggestions.pairs.length > MAX_PAIRS ||
      !state.suggestions.pairs.every((pair) => isText(pair.negativeLabel, 160) && isText(pair.positiveLabel, 160))
    )
      return false;
    if (
      !['options', 'pairs'].every(
        (type) => Array.isArray(state.dismissed[type]) && state.dismissed[type].every((value) => isText(value, 321)),
      )
    )
      return false;
    return true;
  } catch {
    return false;
  }
}

/** Load and migrate a valid decision from browser storage or create a fresh one. */
export function loadState(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY));
    if (isValidState(parsed)) {
      parsed.recognizedOptions ??= [];
      parsed.preparePage ??= parsed.description.trim() ? 'options' : 'mind';
      for (const pair of parsed.pairs) ensureControls(pair, parsed.options);
      if (!parsed.pairs.some((pair) => pair.id === parsed.currentPairId))
        parsed.currentPairId = parsed.pairs[0]?.id ?? null;
      if (
        !canCalculate(parsed) ||
        (parsed.currentStep === 'results' && parsed.inputRevision !== parsed.lastCalculatedRevision)
      )
        parsed.currentStep = 'prepare';
      return parsed;
    }
  } catch {
    /* Unavailable or damaged browser storage must not crash the app. */
  }
  return createState();
}

/** Persist the current decision and report whether browser storage accepted it. */
export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
