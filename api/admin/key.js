import { requireAdmin } from '../../lib/auth.js';
import { revokeKey, deleteKey } from '../../lib/keys.js';

export default requireAdmin(async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });
  if (req.method === 'DELETE') { await deleteKey(id); return res.status(204).end(); }
  if (req.method === 'PATCH')  { await revokeKey(id); return res.status(200).json({ ok: true }); }
  return res.status(405).end();
});