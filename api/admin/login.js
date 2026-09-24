import { checkCreds, signAdmin } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { username, password } = req.body || {};
  if (!checkCreds(username, password)) return res.status(401).json({ error: 'bad credentials' });
  return res.status(200).json({ token: signAdmin() });
}