/**
 * Request handler for the local structured-suggestions API.
 *
 * Imported by: server/index.js.
 * Keeps validation, throttling, provider selection, and timeout cleanup out of
 * the main static-file router.
 */

import { demoSuggestions, openAISuggestions, validRequest } from './ai.js';
import { isAllowedOrigin, json, readJsonBody } from './http.js';

/** Create a bounded suggestion endpoint with the selected provider. */
export function createSuggestionHandler(config = {}) {
  const provider = config.provider ?? process.env.AI_PROVIDER ?? 'demo';
  const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
  const model = config.model ?? process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
  let activeRequests = 0;
  const requestTimes = [];

  return async function handleSuggestion(req, res) {
    if (!isAllowedOrigin(req.headers.origin) || req.headers['sec-fetch-site'] === 'cross-site')
      return json(res, 403, {});
    if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, {});
    let payload;
    try {
      payload = await readJsonBody(req);
    } catch {
      return json(res, 400, {});
    }
    if (!validRequest(payload)) return json(res, 400, {});
    const now = Date.now();
    while (requestTimes.length && requestTimes[0] < now - 60000) requestTimes.shift();
    if (activeRequests >= 2 || requestTimes.length >= 12) return json(res, 429, {});
    activeRequests += 1;
    requestTimes.push(now);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });
    try {
      const output =
        provider === 'demo'
          ? demoSuggestions(payload)
          : provider === 'openai'
            ? await openAISuggestions(payload, {
                apiKey,
                model,
                signal: controller.signal,
                fetchImpl: config.fetchImpl,
              })
            : null;
      if (!output) throw new Error('Unknown provider');
      if (!res.destroyed) json(res, 200, output);
    } catch {
      // No prompts, API keys, or provider response bodies are logged.
      if (!res.destroyed) json(res, 503, {});
    } finally {
      clearTimeout(timeout);
      activeRequests -= 1;
    }
  };
}
