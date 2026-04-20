import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import { query } from './db.js';

const ROLE_PRIORITY = {
  GUEST: 0,
  USER: 1,
  MODERATOR: 2,
  SUPERADMIN: 3,
};

export function authMiddleware(req, _res, next) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  const cookieToken = req.cookies?.access_token ? String(req.cookies.access_token) : null;
  const token = bearerToken || cookieToken;
  if (!token) {
    req.user = { role: 'GUEST' };
    return next();
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = {
      id: payload.sub,
      role: payload.role || 'USER',
      sessionId: payload.sid || null,
    };
  } catch {
    req.user = { role: 'GUEST' };
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: 'Требуется аутентификация' });
  }
  return next();
}

export function requireRole(minRole) {
  return (req, res, next) => {
    const role = req.user?.role || 'GUEST';
    if (ROLE_PRIORITY[role] >= ROLE_PRIORITY[minRole]) {
      return next();
    }
    return res.status(403).json({ message: 'Недостаточно прав' });
  };
}

export async function hashPassword(password) {
  return argon2.hash(password);
}

export async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function signAccessToken({ userId, role, sessionId }) {
  const payload = {
    sub: userId,
    role,
    sid: sessionId,
  };
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '24h',
  });
}

