import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { readConfig } from '../config.mjs';

export const ADMIN_ROOT = fileURLToPath(new URL('./', import.meta.url));
export const UPLOAD_PROVIDERS = ['playmate', 'vidara', 'voe', 'lulustream'];
export const DEFINITIONS = {
  playmate: { base: 'https://api.playmate.to', keyName: 'key', account: '/account/info', upload: '/upload/server', info: '/file/info', codeName: 'file_code', roots: ['playmate.to', 'westernsparka.com'], keyField: 'api_key', fileField: 'vsrc' },
  vidara: { base: 'https://api.vidara.so/v1', keyName: 'api_key', account: '/user/info', upload: '/upload/server', info: '/video/info', codeName: 'filecode', roots: ['vidara.so', 'vidara.to', 's1q2105.com'], keyField: 'api_key', fileField: 'file' },
  voe: { base: 'https://voe.sx/api', keyName: 'key', account: '/account/info', upload: '/upload/server', info: '/file/info', codeName: 'file_code', roots: ['voe.sx', 'voe-network.net', 'cloudwindow-route.com'], keyField: 'key', fileField: 'file', embedTemplate: 'https://voe.sx/e/{code}' },
  lulustream: { base: 'https://api.lulustream.com/api', keyName: 'key', account: '/account/info', upload: '/upload/server', info: '/file/info', codeName: 'file_code', roots: ['lulustream.com', 'tnmr.org'], keyField: 'key', fileField: 'file' },
};
function number(env, name, fallback, min, max) {
  const value = Number(env[name] || fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
  return value;
}
export function adminConfig(env) {
  if (!env) { loadEnv({ path: join(ADMIN_ROOT, '.env'), override: true, quiet: true }); env = process.env; }
  const providers = Object.fromEntries(UPLOAD_PROVIDERS.map((id, index) => {
    const prefix = id.toUpperCase(), definition = DEFINITIONS[id];
    return [id, { id, ...definition, apiKey: env[`${prefix}_API_KEY`] || '',
      base: env[`${prefix}_API_BASE`] || definition.base,
      roots: (env[`${prefix}_UPLOAD_DOMAINS`] || definition.roots.join(',')).split(',').map(v => v.trim()).filter(Boolean),
      keyField: env[`${prefix}_UPLOAD_KEY_FIELD`] || definition.keyField,
      embedTemplate: env[`${prefix}_EMBED_TEMPLATE`] || definition.embedTemplate || '',
      priority: number(env, `${prefix}_PRIORITY`, { voe: 10, playmate: 20, vidara: 30, lulustream: 40 }[id], 0, 10000),
    }];
  }));
  return { root: ADMIN_ROOT, runtime: resolve(ADMIN_ROOT, '.runtime'), providers, catalog: readConfig(),
    concurrency: number(env, 'ADMIN_CONCURRENCY', 2, 1, 4), maxBytes: number(env, 'ADMIN_MAX_VIDEO_BYTES', 5 * 1024 ** 3, 1024, 20 * 1024 ** 3),
    timeoutMs: number(env, 'ADMIN_TRANSFER_TIMEOUT_SECONDS', 1800, 10, 7200) * 1000,
    pollAttempts: number(env, 'ADMIN_POLL_ATTEMPTS', 6, 0, 120), pollSeconds: number(env, 'ADMIN_POLL_SECONDS', 10, 1, 60),
    ffmpeg: env.FFMPEG_PATH || 'ffmpeg', ffprobe: env.FFPROBE_PATH || 'ffprobe',
    posterPublicBase: env.ADMIN_POSTER_PUBLIC_BASE || '',
  };
}

export function safeError(error, secrets = []) {
  let value = String(error?.message || error || 'Unknown error');
  for (const secret of secrets.filter(Boolean)) value = value.split(secret).join('[redacted]');
  return value.replace(/https?:\/\/[^\s"<>]+/g, '[URL]').slice(0, 500);
}
