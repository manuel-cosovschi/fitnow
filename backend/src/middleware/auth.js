import jwt from 'jsonwebtoken';

export function authMiddleware(req, res, next) {
  try {
    const header = req.headers['authorization'] || '';
    const parts = header.split(' ');
    const token = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    const payload = jwt.verify(token, secret);

    // Soportar tokens que usan `sub` (estándar) o `id`
    const userId = payload.id ?? payload.sub;
    if (!userId) return res.status(401).json({ error: 'Invalid token payload' });

    req.user = {
      id: userId,
      email: payload.email || null,
      name: payload.name || null,
      role: payload.role || 'user',
    };

    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}


