/**
 * HTTP entry point for the local decision-matrix application server.
 *
 * Imported by: package scripts and tests/server.test.js.
 * Delegates suggestion requests to suggest.js and built assets to http.js.
 */

import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createSuggestionHandler } from './suggest.js';
import { json, serveAsset, setSecurityHeaders } from './http.js';

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));

/** Create the local API and static asset server. */
export function createServer(config = {}) {
  const provider = config.provider ?? process.env.AI_PROVIDER ?? 'demo';
  const handleSuggestion = createSuggestionHandler(config);
  return http.createServer(async (req, res) => {
    setSecurityHeaders(res);
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      return json(res, 400, {});
    }
    if (req.method === 'GET' && url.pathname === '/api/config') return json(res, 200, { provider });
    if (req.method === 'POST' && url.pathname === '/api/suggest') return handleSuggestion(req, res);
    if ((req.method === 'GET' || req.method === 'HEAD') && (await serveAsset(req, res, distDir, url.pathname)))
      return undefined;
    return json(res, 404, {});
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, host, () =>
    console.log(`Decision Matrix: http://${host}:${port} (${process.env.AI_PROVIDER || 'demo'} mode)`),
  );
}
