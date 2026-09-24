import { runBomb } from '../lib/bomber.js';
import { verifyAndConsume } from '../lib/keys.js';
import { redis } from '../lib/redis.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { phone, mode = 'mix', key, maxApis } = req.body || {};
  if (!phone || !/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'phone must be 10 digits' });
  if (!['mix', 'sms', 'call', 'whatsapp'].includes(mode)) return res.status(400).json({ error: 'bad mode' });
  if (!key) return res.status(401).json({ error: 'missing key' });

  const verdict = await verifyAndConsume(key, mode);
  if (!verdict.ok) return res.status(403).json(verdict);

  await redis.lpush('log:hits', JSON.stringify({ ts: Date.now(), keyId: verdict.id, phone, mode }));
  await redis.ltrim('log:hits', 0, 999);

  try {
    const out = await runBomb({ phone10: phone, mode, maxApis });
    return res.status(200).json({ ...out, remaining_today: verdict.remaining });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}