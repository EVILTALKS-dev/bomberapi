import crypto from 'node:crypto';
import { redis } from './redis.js';

function hash(key) { return crypto.createHash('sha256').update(key).digest('hex'); }
export function generateKey() { return 'vb_' + crypto.randomBytes(24).toString('hex'); }

export async function createKey({ label, modes, dailyQuota, cooldownSec, expiresInDays }) {
  const raw = generateKey();
  const id = hash(raw);
  const record = {
    id,
    label: label || 'unnamed',
    modes: JSON.stringify(modes || ['mix']),
    dailyQuota: dailyQuota ?? 50,
    cooldownSec: cooldownSec ?? 30,
    expiresAt: expiresInDays ? Date.now() + expiresInDays * 86400_000 : 0,
    createdAt: Date.now(),
    revoked: 'false',
  };
  await redis.hset(`key:${id}`, record);
  await redis.sadd('keys:all', id);
  return { key: raw, ...record };
}

export async function listKeys() {
  const ids = await redis.smembers('keys:all');
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  for (const id of ids) pipeline.hgetall(`key:${id}`);
  const rows = await pipeline.exec();
  return rows.filter(Boolean).map(r => ({ ...r, modes: JSON.parse(r.modes || '[]') }));
}

export async function revokeKey(id) { await redis.hset(`key:${id}`, { revoked: 'true' }); }

export async function deleteKey(id) {
  await redis.del(`key:${id}`);
  await redis.srem('keys:all', id);
}

function today() { return new Date().toISOString().slice(0, 10); }

export async function verifyAndConsume(rawKey, mode) {
  const id = hash(rawKey);
  const rec = await redis.hgetall(`key:${id}`);
  if (!rec || !rec.id) return { ok: false, reason: 'invalid_key' };
  if (rec.revoked === 'true') return { ok: false, reason: 'revoked' };
  if (Number(rec.expiresAt) > 0 && Number(rec.expiresAt) < Date.now()) return { ok: false, reason: 'expired' };

  const modes = JSON.parse(rec.modes || '[]');
  if (!modes.includes(mode) && !modes.includes('mix')) return { ok: false, reason: 'mode_not_allowed' };

  const cooldownKey = `cd:${id}`;
  const cd = await redis.get(cooldownKey);
  if (cd) return { ok: false, reason: 'cooldown', retry_in: await redis.ttl(cooldownKey) };

  const quotaKey = `quota:${id}:${today()}`;
  const used = Number(await redis.get(quotaKey) || 0);
  const dailyQuota = Number(rec.dailyQuota || 50);
  if (used >= dailyQuota) return { ok: false, reason: 'quota_exceeded', used, dailyQuota };

  await redis.incr(quotaKey);
  await redis.expire(quotaKey, 86400);
  await redis.set(cooldownKey, 1, { ex: Number(rec.cooldownSec || 30) });

  return { ok: true, id, remaining: dailyQuota - used - 1 };
}