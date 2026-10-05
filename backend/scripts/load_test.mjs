import { performance } from 'node:perf_hooks';
const target = new URL(process.argv[2] || 'http://127.0.0.1:3000/health/ready');
if (!['127.0.0.1', 'localhost'].includes(target.hostname)) throw new Error('This smoke test only targets localhost');
const requests = Number(process.argv[3] || 60);
if (!Number.isInteger(requests) || requests < 1 || requests > 500) throw new Error('Request count must be an integer from 1 to 500');
const concurrency = Math.min(25, requests);
let next = 0; const times = [], statuses = {}, started = performance.now();
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next++ < requests) {
    const before = performance.now();
    try { const response = await fetch(target, { signal: AbortSignal.timeout(10000) }); await response.arrayBuffer(); statuses[response.status] = (statuses[response.status] || 0) + 1; }
    catch { statuses.networkError = (statuses.networkError || 0) + 1; }
    times.push(performance.now() - before);
  }
}));
times.sort((a, b) => a - b);
console.log(JSON.stringify({ requests, concurrency, seconds: +((performance.now() - started) / 1000).toFixed(2),
  p50Ms: +times[Math.floor(times.length * .5)].toFixed(1), p95Ms: +times[Math.min(times.length - 1, Math.floor(times.length * .95))].toFixed(1), statuses,
  note: 'Local smoke measurements only; not a production capacity claim.' }, null, 2));
