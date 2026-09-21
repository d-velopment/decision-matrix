/**
 * Small HTTP primitives shared by the local API and static asset server.
 *
 * Imported by: server/index.js.
 */

import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

/** Send a cache-free JSON response with the supplied HTTP status. */
export function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

/** Read and parse a bounded JSON request body. */
export async function readJsonBody(req, maxBytes = 64 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('Body too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** Apply the response security headers used by every local route. */
export function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  );
}

/** Allow browser requests only from loopback origins. */
export function isAllowedOrigin(originHeader) {
  if (!originHeader) return true;
  try {
    const origin = new URL(originHeader);
    return (
      ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(origin.hostname) &&
      ['http:', 'https:'].includes(origin.protocol)
    );
  } catch {
    return false;
  }
}

/** Check whether a URL maps to one of the built application's public assets. */
function isPermittedAsset(assetPath) {
  return (
    assetPath === 'index.html' ||
    assetPath === 'favicon.svg' ||
    /^assets\/[a-zA-Z0-9_.-]+$/.test(assetPath) ||
    /^guide\/[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)?\.png$/.test(assetPath)
  );
}

/** Serve a permitted built asset, returning false when the route is not an asset. */
export async function serveAsset(req, res, distDir, pathname) {
  const assetPath = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!isPermittedAsset(assetPath)) return false;
  const root = resolve(distDir);
  const file = resolve(root, assetPath);
  if (!file.startsWith(root + sep) && file !== root) return false;
  try {
    const content = await readFile(file);
    res.writeHead(200, {
      'Content-Type': `${MIME_TYPES[extname(file)] || 'application/octet-stream'}; charset=utf-8`,
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    json(res, 404, {});
  }
  return true;
}
