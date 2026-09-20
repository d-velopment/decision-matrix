import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { demoSuggestions, openAISuggestions, validRequest } from './ai.js';

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
async function body(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error('Body too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createServer(config = {}) {
  const provider = config.provider ?? process.env.AI_PROVIDER ?? 'demo';
  const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
  const model = config.model ?? process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
  let activeRequests = 0;
  const requestTimes = [];
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { return json(res, 400, {}); }
    if (req.method === 'GET' && url.pathname === '/api/config') return json(res, 200, { provider });
    if (req.method === 'POST' && url.pathname === '/api/suggest') {
      // Protect the local keyed service while allowing the Vite dev app on another
      // loopback port (for example, the browser app on :5173 and API on :3000).
      if (req.headers.origin) {
        try {
          const origin = new URL(req.headers.origin);
          const isLoopback = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(origin.hostname);
          if (!isLoopback || !['http:', 'https:'].includes(origin.protocol)) return json(res, 403, {});
        } catch { return json(res, 403, {}); }
      }
      if (req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, {});
      if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, {});
      let payload;
      try { payload = await body(req); } catch { return json(res, 400, {}); }
      if (!validRequest(payload)) return json(res, 400, {});
      const now = Date.now();
      while (requestTimes.length && requestTimes[0] < now - 60000) requestTimes.shift();
      if (activeRequests >= 2 || requestTimes.length >= 12) return json(res, 429, {});
      activeRequests++; requestTimes.push(now);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      res.on('close', () => { if (!res.writableEnded) controller.abort(); });
      try {
        const output = provider === 'demo' ? demoSuggestions(payload)
          : provider === 'openai' ? await openAISuggestions(payload, { apiKey, model, signal: controller.signal, fetchImpl: config.fetchImpl })
          : null;
        if (!output) throw new Error('Unknown provider');
        if (!res.destroyed) json(res, 200, output);
      } catch {
        // No prompts, API keys, or provider response bodies are logged.
        if (!res.destroyed) json(res, 503, {});
      } finally { clearTimeout(timeout); activeRequests--; }
      return;
    }
    const assetPath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const file = resolve(distDir, assetPath);
    const permitted = assetPath === 'index.html' || assetPath === 'favicon.svg' || /^assets\/[a-zA-Z0-9_.-]+$/.test(assetPath) || /^guide\/[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)?\.png$/.test(assetPath);
    if ((req.method === 'GET' || req.method === 'HEAD') && permitted && file.startsWith(resolve(distDir) + sep)) {
      try {
        const content = await readFile(file);
        res.writeHead(200, { 'Content-Type': `${mime[extname(file)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-cache' });
        return res.end(req.method === 'HEAD' ? undefined : content);
      } catch { return json(res, 404, {}); }
    }
    json(res, 404, {});
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, host, () => console.log(`Decision Matrix: http://${host}:${port} (${process.env.AI_PROVIDER || 'demo'} mode)`));
}
