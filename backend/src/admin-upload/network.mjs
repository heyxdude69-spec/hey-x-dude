import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { stat, rename, rm, mkdir } from 'node:fs/promises';
import { dirname, basename } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

export function publicAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 ||
      a === 192 && (b === 168 || b === 0 || b === 2) || a === 100 && b >= 64 && b <= 127 || a === 198 && (b === 18 || b === 19 || b === 51) || a === 203 && b === 0);
  }
  if (family === 6) {
    const normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1);
    return /^2[0-9a-f]{3}:/i.test(normalized) && !/^2002:|^2001:(?::|0:|2:|db8:|10:|20:)/i.test(normalized);
  }
  return false;
}
export function allowedHost(host, roots) { return roots.some(root => host === root || host.endsWith(`.${root}`)); }
export function checkedUrl(input, { roots, httpsOnly = false } = {}) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || httpsOnly && url.protocol !== 'https:' || url.username || url.password ||
      url.port && !['80', '443'].includes(url.port) || roots && !allowedHost(url.hostname, roots)) throw new Error('Unapproved network URL');
  return url;
}

export async function request(input, { method = 'GET', headers = {}, body, timeoutMs = 30000, signal, roots, httpsOnly = false } = {}) {
  const url = checkedUrl(input, { roots, httpsOnly });
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw new Error('Private/reserved network address is not allowed');
  const selected = addresses.find(a => a.family === 4) || addresses[0];
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  return new Promise((resolve, reject) => {
    const req = (url.protocol === 'https:' ? https : http).request(url, { method, headers, signal: combined,
      lookup: (_host, options, callback) => options.all ? callback(null, [selected]) : callback(null, selected.address, selected.family),
    }, response => {
      response.once('close', () => clearTimeout(timer));
      resolve(response);
    });
    req.once('error', error => { clearTimeout(timer); reject(error); });
    if (body) pipeline(Readable.from(body), req).catch(error => { req.destroy(error); reject(error); });
    else req.end();
  });
}
export async function jsonRequest(url, options = {}) {
  const response = await request(url, { ...options, httpsOnly: true });
  const chunks = []; let bytes = 0;
  for await (const chunk of response) {
    bytes += chunk.length;
    if (bytes > 1024 * 1024) { response.destroy(); throw new Error('Provider response exceeds 1 MB'); }
    chunks.push(chunk);
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    const error = new Error(`Provider HTTP ${response.statusCode}`); error.httpStatus = response.statusCode; throw error;
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('Provider returned non-JSON data'); }
  if (!value || typeof value !== 'object') throw new Error('Invalid provider response');
  return value;
}
export async function download(url, target, { maxBytes, timeoutMs, signal } = {}) {
  await mkdir(dirname(target), { recursive: true });
  let current = url, response;
  for (let redirect = 0; redirect <= 5; redirect++) {
    response = await request(current, { timeoutMs, signal });
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      const location = response.headers.location; response.destroy();
      if (!location || redirect === 5) throw new Error('Invalid or excessive download redirects');
      current = new URL(location, current).href; continue;
    }
    break;
  }
  if (response.statusCode !== 200) { response.destroy(); throw new Error(`Download HTTP ${response.statusCode}`); }
  if (/text\/html|application\/json/i.test(response.headers['content-type'] || '')) { response.destroy(); throw new Error('Source must be a direct media URL, not a webpage'); }
  if (Number(response.headers['content-length'] || 0) > maxBytes) { response.destroy(); throw new Error('Video exceeds ADMIN_MAX_VIDEO_BYTES'); }
  const temporary = `${target}.${randomUUID()}.part`, hash = createHash('sha256'); let bytes = 0;
  try {
    await pipeline(response, new Transform({ transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > maxBytes) return callback(new Error('Video exceeds ADMIN_MAX_VIDEO_BYTES'));
      hash.update(chunk); callback(null, chunk);
    } }), createWriteStream(temporary, { flags: 'wx' }));
    if (!bytes) throw new Error('Empty video download');
    await rename(temporary, target);
    return { bytes, sha256: hash.digest('hex') };
  } finally { await rm(temporary, { force: true }); }
}
export async function multipart(file, fields, fileField) {
  const boundary = `catalog-${randomUUID()}`;
  const name = basename(file).replace(/[^a-zA-Z0-9._-]/g, '_');
  const entries = Object.entries(fields).map(([key, value]) => {
    if (!/^[a-zA-Z0-9_]+$/.test(key)) throw new Error('Invalid multipart field');
    return Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`);
  });
  if (!/^[a-zA-Z0-9_]+$/.test(fileField)) throw new Error('Invalid multipart file field');
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`), fileSize = (await stat(file)).size;
  return { headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': String(entries.reduce((sum, b) => sum + b.length, 0) + head.length + fileSize + tail.length) },
    body: (async function* () { for (const entry of entries) yield entry; yield head; yield* createReadStream(file); yield tail; })() };
}
