import { requireAdmin } from '../../lib/auth.js';
import { redis } from '../../lib/redis.js';
import { listKeys } from '../../lib/keys.js';

export default requireAdmin(async (req, res) => {
  const keys = await listKeys();
  const recent = await redis.lrange('log:hits', 0, 49);
  const today = new Date().toISOString().slice(0, 10);
  const pipeline = redis.pipeline();
  for (const k of keys) pipeline.get(`quota:${k.id}:${today}`);
  const quotas = await pipeline.exec();
  const usage = keys.map((k, i) => ({ id: k.id, label: k.label, used: Number(quotas[i] || 0) }));
  return res.status(200).json({
    total_keys: keys.length,
    active_keys: keys.filter(k => k.revoked !== 'true').length,
    total_hits_today: usage.reduce((a, b) => a + b.used, 0),
    usage,
    recent: recent.map(r => typeof r === 'string' ? JSON.parse(r) : r),
  });
});