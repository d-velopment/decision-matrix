import test from 'node:test';
import assert from 'node:assert/strict';
import { checkInitialRequest } from '../src/lib/check-initial-request.js';

test('obvious noise requests clarification without attempting semantic classification', () => {
  for (const text of ['', '   ', 'aaaaaaa', '🔥🔥🔥', 'https://example.com www.example.org', 'buy buy buy buy buy buy']) {
    assert.equal(checkInitialRequest(text).action, 'clarify', text);
  }
});

test('vague English prompts ask for context', () => {
  for (const text of ['Help me!', 'I don’t know what to do.', 'I cannot decide']) {
    assert.equal(checkInitialRequest(text).reason, 'needs_context');
  }
});

test('short choices, emotional descriptions, links with context and other languages pass', () => {
  for (const text of ['London or Riga?', 'Stay?', 'Work exhausts me, but leaving scares me.',
    'I cannot decide whether to quit.', 'Compare https://example.com and https://example.org',
    'Москва или Рига?', '転職するか迷っています', 'A or B', 'Perhaps something entirely different']) {
    assert.equal(checkInitialRequest(text).action, 'pass', text);
  }
});
