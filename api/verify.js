import { redis } from '../lib/redis.js';
import crypto from 'node:crypto';

export default async function handler(req, res) {
  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'key required' });
  const id = crypto.createHash('sha256').update(key).digest('hex');
  const rec = await redis.hgetall(`key:${id}`);
  if (!rec || !rec.id) return res.status(404).json({ ok: false, reason: 'invalid' });
  return res.status(200).json({
    ok: rec.revoked !== 'true',
    label: rec.label,
    modes: JSON.parse(rec.modes || '[]'),
    dailyQuota: Number(rec.dailyQuota),
    cooldownSec: Number(rec.cooldownSec),
    expiresAt: Number(rec.expiresAt) || null,
  });
}