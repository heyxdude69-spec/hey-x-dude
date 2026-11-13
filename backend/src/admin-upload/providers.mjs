import { jsonRequest, multipart, checkedUrl, request } from './network.mjs';

export const numeric = value => value !== null && value !== '' && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : undefined;
const positive = value => { const n = numeric(value); return n > 0 ? n : undefined; };
export function cleanUrl(value) {
  if (!value || typeof value !== 'string') return undefined;
  try { const url = checkedUrl(value, { httpsOnly: true }); if (url.search || url.hash) return undefined; return url.href; }
  catch { return undefined; }
}
export function cleanPayload(value, depth = 0) {
  if (depth > 8) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map(v => cleanPayload(v, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 80)
    .filter(([key]) => !/key|token|password|secret|email|balance|preview|cookie/i.test(key))
    .map(([key, data]) => [key, cleanPayload(data, depth + 1)]));
  if (typeof value === 'string') {
    if (/^https?:\/\//.test(value)) { try { const url = new URL(value); url.search = ''; url.hash = ''; url.username = ''; url.password = ''; return url.href; } catch { return '[URL]'; } }
    return value.slice(0, 1000);
  }
  return value;
}
export function boundedPayload(value, secrets = []) {
  let encoded = JSON.stringify(cleanPayload(value));
  for (const secret of secrets.filter(Boolean)) encoded = encoded.split(secret).join('[redacted]');
  return encoded.length <= 15000 ? JSON.parse(encoded) : { note: 'Response omitted: exceeds 15 KB' };
}
function codeFrom(value) {
  if (typeof value !== 'string') throw new Error('Provider did not return a file code');
  const code = /^https:\/\//.test(value) ? new URL(value).pathname.split('/').filter(Boolean).at(-1)?.replace(/\.html$/, '') : value;
  if (!/^[a-zA-Z0-9_-]{1,300}$/.test(code || '')) throw new Error('Invalid provider file code');
  return code;
}
function encodingPage(response, requestedPage) {
  const data = response.data ?? response.result;
  const rows = Array.isArray(data) ? data : data?.data;
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || typeof row.file_code !== 'string')) {
    throw new Error('Invalid encoding-status response');
  }
  const current = Array.isArray(data) ? requestedPage : Number(data.current_page ?? requestedPage);
  const last = Array.isArray(data) ? requestedPage : Number(data.last_page ?? current);
  if (!Number.isInteger(current) || current !== requestedPage || !Number.isInteger(last) || last < current || last > 20) {
    throw new Error('Invalid or excessive encoding-status pagination');
  }
  return { rows, last };
}
export function normalizeUpload(id, response) {
  if (response.success === false || response.status && ![200, '200', 'OK', 'ok'].includes(response.status)) throw new Error('Provider rejected the upload');
  const data = id === 'voe' ? response.file : id === 'lulustream' ? response.files?.[0] : response;
  if (!data || data.status && ![200, '200', 'OK', 'ok'].includes(data.status)) throw new Error('Upload response contains no successful file');
  const rawCode = data.file_code || data.filecode;
  return { code: codeFrom(rawCode), providerVideoId: data.video_id != null ? String(data.video_id) : data.id != null ? String(data.id) : undefined,
    embedUrl: cleanUrl(data.url_embed || data.embed_url || (id === 'playmate' && /^https:\/\//.test(rawCode || '') ? rawCode : undefined)),
    watchUrl: cleanUrl(data.url), raw: boundedPayload(response) };
}
export function normalizeInfo(id, response, code) {
  if (response.success === false || response.status && ![200, '200', 'OK', 'ok'].includes(response.status)) throw new Error('Provider rejected file-info request');
  const list = Array.isArray(response.result) ? response.result : response.result?.files || [response.result || response];
  const data = list.find(row => String(row.file_code || row.filecode || row.fileCode || '') === code);
  if (!data) throw new Error('File-info response did not contain the requested file code');
  const invalid = [404, '404', 'blocked', 'error', 'deleted', 'failed', 'removed'].includes(data.status) || ['blocked', 'error', 'deleted', 'failed'].includes(data.state);
  const ready = !invalid && (id === 'vidara' ? data.status === 'active' && Number(data.file_active) === 1 :
    id === 'voe' ? Number(data.status) === 200 && positive(data.length) !== undefined :
      Number(data.status) === 200 && Number(data.canplay) === 1);
  const resolution = String(data.resolution || '').match(/^(\d+)x(\d+)$/);
  const views = numeric(data.video_views ?? data.file_views ?? data.views);
  return { status: invalid ? 'failed' : ready ? 'ready' : 'processing',
    embedUrl: cleanUrl(data.url_embed || data.embed_url),
    metadata: Object.fromEntries(Object.entries({
      watchUrl: cleanUrl(data.link || data.url), posterUrl: cleanUrl(data.player_img || data.thumbnail),
      durationSeconds: positive(data.video_length ?? data.file_length ?? data.length),
      views: Number.isSafeInteger(views) && views >= 0 ? views : undefined,
      width: positive(data.video?.width ?? resolution?.[1]), height: positive(data.video?.height ?? resolution?.[2]),
    }).filter(([, value]) => value !== undefined)), raw: boundedPayload(response) };
}

export async function playmateGridPoster(code, { transport = request, signal } = {}) {
  if (!/^[a-zA-Z0-9_-]{1,300}$/.test(code || '')) throw new Error('Invalid Playmate file code');
  const page = await transport(`https://playmate.to/embed/${code}`, {
    signal, timeoutMs: 15000, httpsOnly: true, roots: ['playmate.to'], headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (page.statusCode !== 200) { page.destroy(); throw new Error('Playmate poster page unavailable'); }
  const chunks = []; let bytes = 0;
  for await (const chunk of page) {
    bytes += chunk.length;
    if (bytes > 128 * 1024) { page.destroy(); throw new Error('Playmate poster page exceeds 128 KB'); }
    chunks.push(chunk);
  }
  for (const tag of Buffer.concat(chunks).toString('utf8').match(/<meta\b[^>]*>/gi) || []) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m => [m[1].toLowerCase(), m[2]]));
    if (attrs.property?.toLowerCase() !== 'og:image') continue;
    const poster = cleanUrl(attrs.content);
    if (!poster) continue;
    const url = new URL(poster);
    // The CDN hostname comes from the provider; only the verified grid suffix is constructed.
    if (url.pathname !== `/thumbnail/${code}.jpg` && url.pathname !== `/thumbnail/${code}_3x3.jpg`) continue;
    url.pathname = `/thumbnail/${code}_3x3.jpg`;
    const image = await transport(url, { method: 'HEAD', signal, timeoutMs: 15000, httpsOnly: true });
    const valid = image.statusCode === 200 && /^image\/jpeg(?:;|$)/i.test(image.headers['content-type'] || '');
    image.destroy();
    if (valid) return url.href;
  }
  throw new Error('Playmate 3x3 poster unavailable');
}

export class ProviderClient {
  constructor(config, { transport = jsonRequest, posterTransport = request, signal } = {}) { this.config = config; this.transport = transport; this.posterTransport = posterTransport; this.signal = signal; this.nextRequest = 0; }
  async api(path, query = {}) {
    if (!this.config.apiKey) throw new Error(`Missing ${this.config.id.toUpperCase()}_API_KEY`);
    const url = new URL(this.config.base + path);
    url.search = new URLSearchParams({ [this.config.keyName]: this.config.apiKey, ...query });
    for (let attempt = 0; ; attempt++) {
      const scheduled = Math.max(Date.now(), this.nextRequest), wait = scheduled - Date.now();
      this.nextRequest = scheduled + 600; // Reserve slots before waiting; parallel jobs share the same budget.
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      try { return await this.transport(url, { signal: this.signal, timeoutMs: 30000 }); }
      catch (error) {
        if (attempt >= 2 || this.signal?.aborted || error.httpStatus && error.httpStatus !== 429 && error.httpStatus < 500) throw error;
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
      }
    }
  }
  async account() {
    const result = await this.api(this.config.account);
    if (result.success === false || Number(result.status) !== 200) {
      const status = numeric(result.status);
      throw new Error(`Account authentication failed${Number.isInteger(status) ? ` (API status ${status})` : ''}`);
    }
    return { provider: this.config.id, authenticated: true };
  }
  async uploadServer() {
    const response = await this.api(this.config.upload);
    if (response.success === false || Number(response.status) !== 200) throw new Error('Upload-server request failed');
    const result = response.result;
    const uploadUrl = typeof result === 'string' ? result : result?.upload_url || result?.upload_server;
    try { checkedUrl(uploadUrl, { roots: this.config.roots, httpsOnly: true }); }
    catch {
      let hostname; try { hostname = new URL(uploadUrl).hostname; } catch {}
      throw new Error(`${this.config.id}: unapproved upload server${hostname ? ` (${hostname})` : ''}; verify HTTPS and ${this.config.id.toUpperCase()}_UPLOAD_DOMAINS`);
    }
    const keyField = result?.key_field || this.config.keyField, fileField = result?.file_field || this.config.fileField;
    if (!['key', 'api_key'].includes(keyField) || !['file', 'vsrc'].includes(fileField)) throw new Error('Unsupported provider upload fields');
    return { uploadUrl, keyField, fileField };
  }
  async checkUploadServer() {
    const { uploadUrl } = await this.uploadServer();
    return { provider: this.config.id, uploadServerConfigured: true, uploadServerHost: new URL(uploadUrl).hostname };
  }
  async upload(file, metadata, timeoutMs) {
    const { uploadUrl, keyField, fileField } = await this.uploadServer();
    const fields = { [keyField]: this.config.apiKey };
    if (this.config.id === 'lulustream') Object.assign(fields, { file_title: metadata.title, file_descr: metadata.description || '',
      tags: metadata.tags?.join(',') || '', file_adult: metadata.contentRating === 'adult' ? '1' : '0', file_public: '1' });
    const form = await multipart(file, fields, fileField);
    // No automatic POST retry: a timeout could occur after the provider accepted the file.
    let uploaded;
    try { uploaded = await this.transport(uploadUrl, { ...form, method: 'POST', timeoutMs, signal: this.signal, roots: this.config.roots }); }
    catch (error) { error.uncertain = true; throw error; }
    try { const result = normalizeUpload(this.config.id, uploaded); result.raw = boundedPayload(uploaded, [this.config.apiKey]); return result; }
    catch (error) { error.uncertain = true; throw error; }
  }
  async info(code) {
    const response = await this.api(this.config.info, { [this.config.codeName]: code, ...(this.config.id === 'voe' ? { details: 'true' } : {}) });
    const info = normalizeInfo(this.config.id, response, code);
    info.raw = boundedPayload(response, [this.config.apiKey]);
    if (this.config.id === 'playmate' && info.status === 'ready') {
      const poster = await playmateGridPoster(code, { transport: this.posterTransport, signal: this.signal }).catch(() => undefined);
      if (poster) info.metadata.posterUrl = poster;
    }
    if (this.config.id === 'vidara' && info.status === 'ready') {
      const encoding = await this.api('/video/status', { filecode: code });
      if (Number(encoding.status) !== 200) throw new Error('Provider rejected encoding-status request');
      const jobs = encoding.result?.encodings;
      if (Array.isArray(jobs) && jobs.some(job => job.filecode === code && parseFloat(job.progress_percentage) < 100)) info.status = 'processing';
    }
    if (this.config.id === 'voe' && info.status === 'ready') {
      let last = 1;
      for (let page = 1; page <= last; page++) {
        const encoding = await this.api('/encodings/list', page === 1 ? {} : { page: String(page) });
        if (Number(encoding.status) !== 200 || encoding.success === false) throw new Error('Provider rejected encoding-status request');
        const parsed = encodingPage(encoding, page); last = parsed.last;
        const matching = parsed.rows.filter(job => job.file_code === code);
        if (matching.some(job => ['FAILED', 'ERROR'].includes(String(job.status).toUpperCase()))) { info.status = 'failed'; break; }
        if (matching.some(job => !['COMPLETED', 'FINISHED', 'DONE', 'SUCCESS'].includes(String(job.status).toUpperCase()))) info.status = 'processing';
      }
    }
    return info;
  }
  embed(upload, info = {}) {
    const direct = info.embedUrl || upload.embedUrl;
    if (direct) return direct;
    if (!this.config.embedTemplate) return undefined;
    if (this.config.embedTemplate.includes('{videoId}') && !upload.providerVideoId) throw new Error('Embed template requires provider video ID');
    const value = this.config.embedTemplate.replaceAll('{code}', upload.code).replaceAll('{videoId}', upload.providerVideoId || '');
    return cleanUrl(value);
  }
}
