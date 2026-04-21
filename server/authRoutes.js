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

const requestRegisterCodeSchema = registerSchema;
const confirmRegisterCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().trim().regex(/^\d{6}$/, 'Код должен содержать 6 цифр'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(128),
});

const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

const confirmPasswordResetSchema = z.object({
  token: z.string().min(32).max(256),
  newPassword: z.string().min(8).max(128),
});

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

function getClientIp(req) {
  return String(req.ip || '').trim() || null;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function generateVerificationCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashVerificationCode(code) {
  const secret = process.env.EMAIL_OTP_SECRET || process.env.JWT_ACCESS_SECRET;
  return crypto.createHmac('sha256', secret).update(code).digest('hex');
}

async function sendVerificationCodeEmail({ email, code }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[auth] Email verification code for ${email}: ${code}`);
      return;
    }
    throw new Error('SMTP не настроен: задайте SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM');
  }

  let nodemailer;
  try {
    nodemailer = await import('nodemailer');
  } catch {
    throw new Error('Для SMTP-отправки установите зависимость nodemailer в server/package.json');
  }
  const transporter = nodemailer.default.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: email,
    subject: 'Код подтверждения регистрации',
    text: `Ваш код подтверждения: ${code}. Код действителен 10 минут.`,
  });
}

async function sendPasswordResetEmail({ email, resetLink }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[auth] Password reset link for ${email}: ${resetLink}`);
      return;
    }
    throw new Error('SMTP не настроен: задайте SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM');
  }

  let nodemailer;
  try {
    nodemailer = await import('nodemailer');
  } catch {
    throw new Error('Для SMTP-отправки установите зависимость nodemailer в server/package.json');
  }
  const transporter = nodemailer.default.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: email,
    subject: 'Сброс пароля',
    text: `Чтобы сбросить пароль, перейдите по ссылке: ${resetLink}. Ссылка действует 30 минут.`,
    html: `<div style="font-family:Arial,sans-serif;padding:20px;background:#f6f8fb">
      <div style="max-width:560px;margin:0 auto;background:#fff;padding:24px;border-radius:12px">
        <h2 style="margin:0 0 12px;color:#1f2937">Сброс пароля</h2>
        <p style="color:#4b5563">Нажмите кнопку, чтобы задать новый пароль. Ссылка действует 30 минут.</p>
        <a href="${resetLink}" style="display:inline-block;margin-top:8px;background:#2f7d32;color:#fff;padding:12px 16px;text-decoration:none;border-radius:8px">Сбросить пароль</a>
      </div>
    </div>`,
  });
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

function setAccessCookie(res, token) {
  res.cookie('access_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });
}

router.post('/register/request-code', async (req, res) => {
  try {
    const parsed = requestRegisterCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      const issueMsg = parsed.error.issues.map((i) => i.message).filter(Boolean)[0];
      return res.status(400).json({
        message: issueMsg ?? 'Неверные данные',
        issues: parsed.error.issues,
      });
    }
    const { email, password, fullName } = parsed.data;
    const normalizedEmail = normalizeEmail(email);
    const now = new Date();
    const OTP_TTL_MS = 10 * 60 * 1000;
    const RESEND_COOLDOWN_MS = 60 * 1000;
    const RESEND_WINDOW_MS = 60 * 60 * 1000;
    const MAX_RESEND_PER_WINDOW = 5;

    const existing = await query('SELECT id FROM users WHERE email = $1 LIMIT 1', [normalizedEmail]);
    if (existing.rows.length) {
      return res.json({ ok: true, message: 'Если email доступен, код будет отправлен' });
    }

    const passwordHash = await hashPassword(password);
    const existingCode = await query(
      `SELECT id, resend_count AS "resendCount", resend_window_started_at AS "windowStart", last_sent_at AS "lastSentAt"
       FROM email_verification_codes
       WHERE email = $1
       LIMIT 1`,
      [normalizedEmail],
    );

    let resendCount = 1;
    let windowStart = now;
    if (existingCode.rows.length) {
      const row = existingCode.rows[0];
      const lastSentAt = new Date(row.lastSentAt);
      if (now.getTime() - lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
        return res.status(429).json({ message: 'Повторная отправка возможна через 60 секунд' });
      }
      windowStart = new Date(row.windowStart);
      if (now.getTime() - windowStart.getTime() > RESEND_WINDOW_MS) {
        resendCount = 1;
        windowStart = now;
      } else {
        resendCount = Number(row.resendCount) + 1;
      }
      if (resendCount > MAX_RESEND_PER_WINDOW) {
        return res.status(429).json({ message: 'Превышен лимит отправки кода. Попробуйте позже' });
      }
    }

    const code = generateVerificationCode();
    const codeHash = hashVerificationCode(code);
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

    await query(
      `INSERT INTO email_verification_codes (
         email, code_hash, password_hash, full_name, attempts_used, resend_count,
         resend_window_started_at, expires_at, last_sent_at, consumed_at, created_at
       )
       VALUES ($1,$2,$3,$4,0,$5,$6,$7,$8,NULL,$8)
       ON CONFLICT (email)
       DO UPDATE SET
         code_hash = EXCLUDED.code_hash,
         password_hash = EXCLUDED.password_hash,
         full_name = EXCLUDED.full_name,
         attempts_used = 0,
         resend_count = EXCLUDED.resend_count,
         resend_window_started_at = EXCLUDED.resend_window_started_at,
         expires_at = EXCLUDED.expires_at,
         last_sent_at = EXCLUDED.last_sent_at,
         consumed_at = NULL`,
      [normalizedEmail, codeHash, passwordHash, fullName, resendCount, windowStart.toISOString(), expiresAt.toISOString(), now.toISOString()],
    );

    await sendVerificationCodeEmail({ email: normalizedEmail, code });

    return res.status(201).json({
      ok: true,
      message: 'Код подтверждения отправлен на email',
    });
  } catch (err) {
    console.error('register request-code error:', err);
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Ошибка отправки кода',
    });
  }
});

router.post('/register/confirm', async (req, res) => {
  try {
    const parsed = confirmRegisterCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      const issueMsg = parsed.error.issues.map((i) => i.message).filter(Boolean)[0];
      return res.status(400).json({ message: issueMsg ?? 'Неверные данные', issues: parsed.error.issues });
    }

    const { email, code } = parsed.data;
    const normalizedEmail = normalizeEmail(email);
    const now = new Date();
    const MAX_ATTEMPTS = 5;

    const pending = await query(
      `SELECT id, email, code_hash AS "codeHash", password_hash AS "passwordHash", full_name AS "fullName",
              attempts_used AS "attemptsUsed", expires_at AS "expiresAt", consumed_at AS "consumedAt"
       FROM email_verification_codes
       WHERE email = $1
       LIMIT 1`,
      [normalizedEmail],
    );

    if (!pending.rows.length) {
      return res.status(400).json({ message: 'Код недействителен или истек' });
    }

    const row = pending.rows[0];
    if (row.consumedAt || new Date(row.expiresAt) < now) {
      return res.status(400).json({ message: 'Код недействителен или истек' });
    }
    if (Number(row.attemptsUsed) >= MAX_ATTEMPTS) {
      return res.status(429).json({ message: 'Превышено количество попыток. Запросите новый код' });
    }

    const codeHash = hashVerificationCode(code);
    if (codeHash !== row.codeHash) {
      await query(
        `UPDATE email_verification_codes
         SET attempts_used = attempts_used + 1
         WHERE id = $1`,
        [row.id],
      );
      return res.status(400).json({ message: 'Неверный код подтверждения' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1 LIMIT 1', [normalizedEmail]);
    if (existing.rows.length) {
      await query('DELETE FROM email_verification_codes WHERE id = $1', [row.id]);
      return res.status(409).json({ message: 'Пользователь с таким email уже существует' });
    }

    const inserted = await query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1,$2,$3,$4)
       RETURNING id, email, full_name AS "fullName", role`,
      [normalizedEmail, row.passwordHash, row.fullName, 'USER'],
    );
    const user = inserted.rows[0];

    await query(
      `UPDATE email_verification_codes
       SET consumed_at = NOW()
       WHERE id = $1`,
      [row.id],
    );

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
    setAccessCookie(res, accessToken);

    return res.status(201).json({ user });
  } catch (err) {
    console.error('register confirm error:', err);
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Ошибка подтверждения регистрации',
    });
  }
});

router.post('/password-reset/request', async (req, res) => {
  try {
    const parsed = requestPasswordResetSchema.safeParse(req.body);
    if (!parsed.success) {
      const issueMsg = parsed.error.issues.map((i) => i.message).filter(Boolean)[0];
      return res.status(400).json({ message: issueMsg ?? 'Неверные данные' });
    }

    const normalizedEmail = normalizeEmail(parsed.data.email);
    const now = new Date();
    const TOKEN_TTL_MS = 30 * 60 * 1000;
    const RESEND_COOLDOWN_MS = 60 * 1000;

    const userResult = await query(
      `SELECT id, email
       FROM users
       WHERE email = $1 AND is_active = TRUE
       LIMIT 1`,
      [normalizedEmail],
    );

    if (!userResult.rows.length) {
      return res.json({ ok: true, message: 'Если email существует, ссылка отправлена' });
    }

    const userRow = userResult.rows[0];
    const existingToken = await query(
      `SELECT id, last_sent_at AS "lastSentAt"
       FROM password_reset_tokens
       WHERE user_id = $1
         AND consumed_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userRow.id],
    );
    if (existingToken.rows.length) {
      const lastSentAt = new Date(existingToken.rows[0].lastSentAt);
      if (now.getTime() - lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
        return res.status(429).json({ message: 'Повторный запрос возможен через 60 секунд' });
      }
    }

    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);
    await query(
      `UPDATE password_reset_tokens
       SET consumed_at = NOW()
       WHERE user_id = $1
         AND consumed_at IS NULL`,
      [userRow.id],
    );
    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at, last_sent_at)
       VALUES ($1,$2,$3,$4,$4)`,
      [userRow.id, tokenHash, expiresAt.toISOString(), now.toISOString()],
    );

    const publicBaseUrl = process.env.APP_PUBLIC_URL || process.env.CLIENT_URL || 'http://localhost:5173';
    const resetLink = `${publicBaseUrl.replace(/\/$/, '')}/login?mode=reset&token=${encodeURIComponent(plainToken)}`;
    await sendPasswordResetEmail({ email: userRow.email, resetLink });

    await createAuditLog({
      req,
      action: 'USER_PASSWORD_RESET_REQUEST',
      entityType: 'USER',
      entityId: String(userRow.id),
      severity: 'INFO',
    });

    return res.json({ ok: true, message: 'Если email существует, ссылка отправлена' });
  } catch (err) {
    console.error('password reset request error:', err);
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Ошибка запроса на сброс пароля',
    });
  }
});

router.post('/password-reset/confirm', async (req, res) => {
  try {
    const parsed = confirmPasswordResetSchema.safeParse(req.body);
    if (!parsed.success) {
      const issueMsg = parsed.error.issues.map((i) => i.message).filter(Boolean)[0];
      return res.status(400).json({ message: issueMsg ?? 'Неверные данные' });
    }

    const { token, newPassword } = parsed.data;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const tokenResult = await query(
      `SELECT t.id, t.user_id AS "userId", t.expires_at AS "expiresAt", t.consumed_at AS "consumedAt", u.is_active AS "isActive"
       FROM password_reset_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );
    if (!tokenResult.rows.length) {
      return res.status(400).json({ message: 'Ссылка недействительна или истекла' });
    }

    const row = tokenResult.rows[0];
    const now = new Date();
    if (row.consumedAt || new Date(row.expiresAt) < now || !row.isActive) {
      return res.status(400).json({ message: 'Ссылка недействительна или истекла' });
    }

    const newHash = await hashPassword(newPassword);
    await query(
      `UPDATE users
       SET password_hash = $2, updated_at = NOW()
       WHERE id = $1`,
      [row.userId, newHash],
    );
    await query(
      `UPDATE password_reset_tokens
       SET consumed_at = NOW()
       WHERE id = $1`,
      [row.id],
    );
    await query(
      `UPDATE sessions
       SET revoked_at = NOW()
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [row.userId],
    );

    await createAuditLog({
      req,
      action: 'USER_PASSWORD_RESET_CONFIRM',
      entityType: 'USER',
      entityId: String(row.userId),
      severity: 'INFO',
    });

    res.clearCookie('refresh_token', { path: '/api/auth' });
    res.clearCookie('access_token', { path: '/' });
    return res.json({ ok: true, message: 'Пароль обновлен. Выполните вход с новым паролем' });
  } catch (err) {
    console.error('password reset confirm error:', err);
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Ошибка подтверждения сброса пароля',
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
    setAccessCookie(res, accessToken);

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
    setAccessCookie(res, accessToken);

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
  res.clearCookie('access_token', { path: '/' });

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

