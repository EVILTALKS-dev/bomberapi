import jwt from 'jsonwebtoken';

const ADMIN_USERNAME = 'EVILTALKS';
const ADMIN_PASSWORD = 'ET';
const JWT_SECRET = process.env.JWT_SECRET || 'evil-talks-secret-key-2026';

export function checkCreds(username, password) {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export function signAdmin() {
  return jwt.sign({ role: 'admin', user: ADMIN_USERNAME }, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return false;
  try {
    const p = jwt.verify(token, JWT_SECRET);
    return p.role === 'admin';
  } catch { return false; }
}

export function requireAdmin(handler) {
  return async (req, res) => {
    if (!verifyAdmin(req)) return res.status(401).json({ error: 'unauthorized' });
    return handler(req, res);
  };
}