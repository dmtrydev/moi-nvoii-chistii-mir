import express from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { query } from './db.js';
import { hashPassword, verifyPassword, signAccessToken, requireAuth } from './auth.js';
import { createAuditLog } from './audit.js';

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(120),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(128),
});

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

function getClientIp(req) {
  const raw = (req.headers['x-forwarded-for'] || req.ip || '').toString();
  return raw.split(',')[0].trim() || null;
}

async function createSession({ userId, req }) {
  const refreshToken = generateRefreshToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const ua = (req.headers['user-agent'] || '').toString();
  const ip = getClientIp(req);

  const result = await query(
    `INSERT INTO sessions (user_id, refresh_token, user_agent, ip_address, created_at, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [userId, refreshToken, ua, ip, now.toISOString(), expiresAt.toISOString()],
  );

  return { sessionId: result.rows[0].id, refreshToken, expiresAt };
}

function setRefreshCookie(res, token, expiresAt) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/api/auth',
  });
}

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const issueMsg = parsed.error.issues.map((i) => i.message).filter(Boolean)[0];
      return res.status(400).json({
        message: issueMsg ?? 'Неверные данные',
        issues: parsed.error.issues,
      });
    }
    const { email, password, fullName } = parsed.data;

    const existing = await query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
    if (existing.rows.length) {
      return res.status(409).json({ message: 'Пользователь с таким email уже существует' });
    }

    const passwordHash = await hashPassword(password);
    const inserted = await query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1,$2,$3,$4)
       RETURNING id, email, full_name AS "fullName", role`,
      [email, passwordHash, fullName, 'USER'],
    );

    const user = inserted.rows[0];

    await createAuditLog({
      req,
      action: 'USER_REGISTER',
      entityType: 'USER',
      entityId: String(user.id),
      severity: 'INFO',
      changes: { after: { id: user.id, email: user.email, role: user.role } },
    });

    const { sessionId, refreshToken, expiresAt } = await createSession({ userId: user.id, req });
    const accessToken = signAccessToken({ userId: user.id, role: user.role, sessionId });
    setRefreshCookie(res, refreshToken, expiresAt);

    return res.status(201).json({
      user,
      accessToken,
    });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Ошибка регистрации',
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const issueMsg = parsed.error.issues.map((i) => i.message).filter(Boolean)[0];
      return res.status(400).json({
        message: issueMsg ?? 'Неверные данные',
        issues: parsed.error.issues,
      });
    }
    const { email, password } = parsed.data;

    const result = await query(
      `SELECT id, email, password_hash, full_name AS "fullName", role, is_active
       FROM users WHERE email = $1 LIMIT 1`,
      [email],
    );
    if (!result.rows.length) {
      await createAuditLog({
        req,
        action: 'USER_LOGIN_FAILED',
        entityType: 'USER',
        severity: 'WARNING',
        metadata: { reason: 'user_not_found', email },
      });
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ message: 'Пользователь заблокирован' });
    }

    const ok = await verifyPassword(user.password_hash, password);
    if (!ok) {
      await createAuditLog({
        req,
        action: 'USER_LOGIN_FAILED',
        entityType: 'USER',
        entityId: String(user.id),
        severity: 'WARNING',
        metadata: { reason: 'bad_password' },
      });
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    const { sessionId, refreshToken, expiresAt } = await createSession({ userId: user.id, req });
    const accessToken = signAccessToken({ userId: user.id, role: user.role, sessionId });
    setRefreshCookie(res, refreshToken, expiresAt);

    await createAuditLog({
      req,
      action: 'USER_LOGIN',
      entityType: 'USER',
      entityId: String(user.id),
      severity: 'INFO',
      metadata: { sessionId },
    });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      accessToken,
    });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Ошибка входа',
    });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) {
      return res.status(401).json({ message: 'Нет refresh токена' });
    }

    const now = new Date();
    const result = await query(
      `SELECT s.id, s.user_id AS "userId", s.expires_at AS "expiresAt", s.revoked_at AS "revokedAt",
              u.email, u.full_name AS "fullName", u.role, u.is_active
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.refresh_token = $1
       LIMIT 1`,
      [token],
    );

    if (!result.rows.length) {
      return res.status(401).json({ message: 'Сессия не найдена' });
    }

    const row = result.rows[0];
    if (row.revokedAt || new Date(row.expiresAt) < now || !row.is_active) {
      return res.status(401).json({ message: 'Сессия истекла или отозвана' });
    }

    // ротация refresh токена
    const newToken = generateRefreshToken();
    const newExpires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await query(
      `UPDATE sessions
       SET refresh_token = $2, expires_at = $3
       WHERE id = $1`,
      [row.id, newToken, newExpires.toISOString()],
    );

    const accessToken = signAccessToken({ userId: row.userId, role: row.role, sessionId: row.id });
    setRefreshCookie(res, newToken, newExpires);

    await createAuditLog({
      req,
      action: 'SESSION_REFRESH',
      entityType: 'SESSION',
      entityId: String(row.id),
      severity: 'INFO',
    });

    return res.json({
      user: {
        id: row.userId,
        email: row.email,
        fullName: row.fullName,
        role: row.role,
      },
      accessToken,
    });
  } catch (err) {
    console.error('refresh error:', err);
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Ошибка refresh',
    });
  }
});

router.post('/logout', async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (token) {
    await query(
      `UPDATE sessions
       SET revoked_at = NOW()
       WHERE refresh_token = $1`,
      [token],
    );
  }
  res.clearCookie('refresh_token', { path: '/api/auth' });

  await createAuditLog({
    req,
    action: 'USER_LOGOUT',
    entityType: 'SESSION',
    severity: 'INFO',
  });

  return res.json({ ok: true });
});

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      const issueMsg = parsed.error.issues.map((i) => i.message).filter(Boolean)[0];
      return res.status(400).json({ message: issueMsg ?? 'Неверные данные' });
    }

    const userId = Number(req.user?.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ message: 'Требуется аутентификация' });
    }

    const { oldPassword, newPassword } = parsed.data;

    const result = await query(
      `SELECT password_hash
       FROM users
       WHERE id = $1 AND is_active = TRUE
       LIMIT 1`,
      [userId],
    );

    if (!result.rows.length) {
      return res.status(401).json({ message: 'Пользователь не найден' });
    }

    const passwordHash = result.rows[0].password_hash;
    const ok = await verifyPassword(passwordHash, oldPassword);
    if (!ok) {
      return res.status(401).json({ message: 'Неверный пароль' });
    }

    const newHash = await hashPassword(newPassword);
    await query(
      `UPDATE users
       SET password_hash = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, newHash],
    );

    await createAuditLog({
      req,
      action: 'USER_PASSWORD_CHANGE',
      entityType: 'USER',
      entityId: String(userId),
      severity: 'INFO',
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('change-password error:', err);
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Ошибка смены пароля',
    });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const userId = Number(req.user?.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(401).json({ message: 'Требуется аутентификация' });
  }

  const result = await query(
    `SELECT id, email, full_name AS "fullName", role
     FROM users
     WHERE id = $1 AND is_active = TRUE
     LIMIT 1`,
    [userId],
  );

  if (!result.rows.length) {
    return res.status(401).json({ message: 'Пользователь не найден' });
  }

  return res.json({ user: result.rows[0] });
});

export default router;

