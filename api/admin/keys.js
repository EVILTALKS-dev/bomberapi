import { requireAdmin } from '../../lib/auth.js';
import { createKey, listKeys } from '../../lib/keys.js';

export default requireAdmin(async (req, res) => {
  if (req.method === 'GET') return res.status(200).json(await listKeys());
  if (req.method === 'POST') {
    const { label, modes, dailyQuota, cooldownSec, expiresInDays } = req.body || {};
    return res.status(201).json(await createKey({ label, modes, dailyQuota, cooldownSec, expiresInDays }));
  }
  return res.status(405).end();
});