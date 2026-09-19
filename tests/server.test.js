import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server/index.js';
import { openAISuggestions, validRequest, demoSuggestions } from '../server/ai.js';
const request = { description: 'I am deciding whether to move to another city.', intent: 'initial', options: [], pairs: [], messages: [], dismissed: { options: [], pairs: [] } };
async function serve(t, config = {}) {
  const server = createServer({ provider: 'demo', ...config });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
const post = (base, payload, headers = {}) => fetch(`${base}/api/suggest`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) });

test('demo API works without a key and honors language and capacity', async t => {
  const base = await serve(t);
  assert.deepEqual(await (await fetch(base + '/api/config')).json(), { provider: 'demo' });
  const response = await post(base, request);
  assert.equal(response.status, 200);
  const data = await response.json(); assert.equal(data.options.length, 3); assert.equal(data.pairs.length, 8);
  const ru = demoSuggestions({ ...request, description: 'Я хочу переехать в другой город, но не знаю куда.' });
  assert.match(ru.message, /примеры/); assert.match(ru.pairs[0].negativeLabel, /напряжение/);
  assert.equal(demoSuggestions({ ...request, options: ['a', 'b', 'c', 'd', 'e', 'f'] }).options.length, 0);
});
test('invalid, oversized, and cross-origin requests cannot invoke a provider', async t => {
  const base = await serve(t);
  assert.equal((await post(base, {})).status, 400);
  assert.equal((await post(base, { ...request, description: 'x'.repeat(70000) })).status, 400);
  assert.equal((await post(base, request, { Origin: 'https://unrelated.example' })).status, 403);
  assert.equal((await fetch(base + '/.env')).status, 404);
  assert.equal((await fetch(base + '/server/ai.js')).status, 404);
  assert.equal(validRequest({ ...request, options: Array(7).fill('x') }), false);
});
test('unconfigured live provider fails quietly with no key leakage', async t => {
  const base = await serve(t, { provider: 'openai', apiKey: '' });
  const response = await post(base, request);
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), {});
});
test('OpenAI contract uses structured Responses output without storing the response', async () => {
  let sent;
  const output = { message: 'A question?', mentionedOptions: [], options: [], pairs: [] };
  const fetchImpl = async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    sent = JSON.parse(init.body);
    assert.equal(init.headers.Authorization, 'Bearer test-only');
    return { ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] }) };
  };
  assert.deepEqual(await openAISuggestions(request, { apiKey: 'test-only', model: 'configured-model', fetchImpl }), output);
  assert.equal(sent.store, false); assert.equal(sent.model, 'configured-model');
  assert.equal(sent.text.format.strict, true); assert.equal(sent.text.format.type, 'json_schema');
  assert.ok(!sent.input[0].content.includes('importanceRaw'));
});
test('refusals, incomplete output, and malformed responses are rejected', async () => {
  for (const value of [{ status: 'incomplete' }, { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }, { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{}' }] }] }]) {
    await assert.rejects(openAISuggestions(request, { apiKey: 'test', model: 'test', fetchImpl: async () => ({ ok: true, json: async () => value }) }));
  }
});
