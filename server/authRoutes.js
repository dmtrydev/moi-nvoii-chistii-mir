import express from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { query } from './db.js';
import { hashPassword, verifyPassword, signAccessToken, requireAuth } from './auth.js';
import { createAuditLog } from './audit.js';
import {
  buildFrontendAuthRedirect,
  buildYandexAuthorizeUrl,
  exchangeCodeForToken,
  extractYandexIdentity,
  fetchYandexProfile,
  getYandexOauthConfig,
  issueOauthState,
  verifyAndConsumeOauthState,
} from './oauth/yandex.js';

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

const login2faSchema = z.object({
  challengeToken: z.string().min(24).max(256),
  totpCode: z.string().trim().regex(/^\d{6}$/).optional(),
  recoveryCode: z.string().trim().min(6).max(32).optional(),
});

const setup2faEnableSchema = z.object({
  totpCode: z.string().trim().regex(/^\d{6}$/),
});

const disable2faSchema = z.object({
  totpCode: z.string().trim().regex(/^\d{6}$/).optional(),
  recoveryCode: z.string().trim().min(6).max(32).optional(),
});

const requestSecurityPasswordChangeSchema = z.object({
  oldPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(128),
});

const confirmSecurityPasswordChangeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
});

const updateSecuritySettingsSchema = z.object({
  primaryLoginMethod: z.enum(['PASSWORD', 'PASSWORD_TOTP']).optional(),
  allowImageLogin: z.boolean().optional(),
  allowMessengerLogin: z.boolean().optional(),
  allowQrLogin: z.boolean().optional(),
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

function hashOneTimeToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getEncryptionKey() {
  const secret = process.env.AUTH_ENCRYPTION_SECRET || process.env.EMAIL_OTP_SECRET || process.env.JWT_ACCESS_SECRET || 'dev-secret';
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptValue(plainText) {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptValue(cipherText) {
  const [ivHex, tagHex, dataHex] = String(cipherText || '').split(':');
  if (!ivHex || !tagHex || !dataHex) return '';
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

function base32Encode(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(base32) {
  const clean = String(base32 || '').replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function generateTotpCode(secret, timestamp = Date.now()) {
  const step = 30;
  const counter = Math.floor(timestamp / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

function verifyTotpCode(secret, code) {
  const now = Date.now();
  const normalized = String(code || '').trim();
  for (const offset of [-30_000, 0, 30_000]) {
    const valid = generateTotpCode(secret, now + offset);
    if (crypto.timingSafeEqual(Buffer.from(valid), Buffer.from(normalized))) {
      return true;
    }
  }
  return false;
}

function generateRecoveryCodes() {
  const codes = [];
  for (let i = 0; i < 8; i += 1) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
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

async function sendSecurityCodeEmail({ email, code, actionLabel }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[auth] Security code (${actionLabel}) for ${email}: ${code}`);
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
    subject: `Подтверждение действия: ${actionLabel}`,
    text: `Код подтверждения: ${code}. Код действителен 10 минут.`,
  });
}

async function sendSecurityEventEmail({ email, subject, text }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  if (!host || !user || !pass || !from) return;

  let nodemailer;
  try {
    nodemailer = await import('nodemailer');
  } catch {
    return;
  }
  const transporter = nodemailer.default.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  await transporter.sendMail({ from, to: email, subject, text });
}

async function completeLogin({ user, req, res }) {
  const { sessionId, refreshToken, expiresAt } = await createSession({ userId: user.id, req });
  const accessToken = signAccessToken({ userId: user.id, role: user.role, sessionId });
  setRefreshCookie(res, refreshToken, expiresAt);
  setAccessCookie(res, accessToken);
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };
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

router.get('/yandex/start', async (_req, res) => {
  try {
    const config = getYandexOauthConfig();
    const state = issueOauthState(res);
    const redirectUrl = buildYandexAuthorizeUrl({
      authorizeUrl: config.authorizeUrl,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      scope: config.scope,
      state,
    });
    return res.redirect(302, redirectUrl);
  } catch (err) {
    console.error('yandex oauth start error:', err);
    const redirectUrl = buildFrontendAuthRedirect({
      ok: false,
      message: 'Yandex OAuth is not configured',
    });
    return res.redirect(302, redirectUrl);
  }
});

router.get('/yandex/callback', async (req, res) => {
  try {
    const code = String(req.query?.code ?? '').trim();
    const incomingState = String(req.query?.state ?? '').trim();
    const isStateValid = verifyAndConsumeOauthState(req, res, incomingState);
    if (!isStateValid) {
      return res.redirect(
        302,
        buildFrontendAuthRedirect({ ok: false, message: 'OAuth state is invalid or expired' }),
      );
    }
    if (!code) {
      return res.redirect(
        302,
        buildFrontendAuthRedirect({ ok: false, message: 'Yandex did not return authorization code' }),
      );
    }

    const config = getYandexOauthConfig();
    const accessToken = await exchangeCodeForToken({
      tokenUrl: config.tokenUrl,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      code,
    });
    const profile = await fetchYandexProfile({
      infoUrl: config.infoUrl,
      accessToken,
    });
    const identity = extractYandexIdentity(profile);
    if (!identity.providerUserId) {
      return res.redirect(
        302,
        buildFrontendAuthRedirect({ ok: false, message: 'Yandex profile does not include user id' }),
      );
    }

    let user = null;
    const linked = await query(
      `SELECT u.id, u.email, u.full_name AS "fullName", u.role, u.is_active AS "isActive"
       FROM user_oauth_accounts oa
       JOIN users u ON u.id = oa.user_id
       WHERE oa.provider = 'YANDEX'
         AND oa.provider_user_id = $1
       LIMIT 1`,
      [identity.providerUserId],
    );
    if (linked.rows.length) {
      user = linked.rows[0];
      if (!user.isActive) {
        return res.redirect(
          302,
          buildFrontendAuthRedirect({ ok: false, message: 'User is blocked' }),
        );
      }
    }

    if (!user) {
      if (!identity.email) {
        return res.redirect(
          302,
          buildFrontendAuthRedirect({ ok: false, message: 'Yandex account has no email' }),
        );
      }
      const existingByEmail = await query(
        `SELECT id, email, full_name AS "fullName", role, is_active AS "isActive"
         FROM users
         WHERE email = $1
         LIMIT 1`,
        [identity.email],
      );

      if (existingByEmail.rows.length) {
        user = existingByEmail.rows[0];
        if (!user.isActive) {
          return res.redirect(
            302,
            buildFrontendAuthRedirect({ ok: false, message: 'User is blocked' }),
          );
        }
      } else {
        const generatedPasswordHash = await hashPassword(crypto.randomBytes(32).toString('hex'));
        const created = await query(
          `INSERT INTO users (email, password_hash, full_name, role)
           VALUES ($1,$2,$3,'USER')
           RETURNING id, email, full_name AS "fullName", role, is_active AS "isActive"`,
          [identity.email, generatedPasswordHash, identity.fullName || identity.email],
        );
        user = created.rows[0];
        await createAuditLog({
          req,
          action: 'USER_REGISTER',
          entityType: 'USER',
          entityId: String(user.id),
          severity: 'INFO',
          metadata: { via: 'YANDEX_OAUTH' },
          changes: { after: { id: user.id, email: user.email, role: user.role } },
        });
      }

      try {
        await query(
          `INSERT INTO user_oauth_accounts (user_id, provider, provider_user_id, email_at_link)
           VALUES ($1,'YANDEX',$2,$3)
           ON CONFLICT (provider, user_id) DO NOTHING`,
          [user.id, identity.providerUserId, identity.email || null],
        );
      } catch (err) {
        if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
          return res.redirect(
            302,
            buildFrontendAuthRedirect({ ok: false, message: 'Yandex account already linked to another user' }),
          );
        }
        throw err;
      }
    }

    await completeLogin({ user, req, res });
    await createAuditLog({
      req,
      action: 'USER_LOGIN',
      entityType: 'USER',
      entityId: String(user.id),
      severity: 'INFO',
      metadata: { via: 'YANDEX_OAUTH', twoFactor: false },
    });
    void sendSecurityEventEmail({
      email: user.email,
      subject: 'Новый вход в аккаунт',
      text: `Вход через Яндекс OAuth. IP: ${getClientIp(req) || 'unknown'}, device: ${(req.headers['user-agent'] || '').toString() || 'unknown'}`,
    });

    const redirectTo = buildFrontendAuthRedirect({ ok: true });
    return res.redirect(302, redirectTo);
  } catch (err) {
    console.error('yandex oauth callback error:', err);
    const redirectUrl = buildFrontendAuthRedirect({
      ok: false,
      message: err instanceof Error ? err.message : 'Yandex OAuth failed',
    });
    return res.redirect(302, redirectUrl);
  }
});

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
    void sendSecurityEventEmail({
      email: userRow.email,
      subject: 'Запрос на сброс пароля',
      text: 'Если это были не вы, срочно смените пароль и включите 2FA.',
    });

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

router.get('/security/overview', requireAuth, async (req, res) => {
  const userId = Number(req.user?.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(401).json({ message: 'Требуется аутентификация' });
  }

  const [settingsResult, sessionsResult] = await Promise.all([
    query(
      `SELECT two_factor_enabled AS "twoFactorEnabled",
              trusted_device_days AS "trustedDeviceDays",
              primary_login_method AS "primaryLoginMethod",
              allow_image_login AS "allowImageLogin",
              allow_messenger_login AS "allowMessengerLogin",
              allow_qr_login AS "allowQrLogin"
       FROM user_security_settings
       WHERE user_id = $1
       LIMIT 1`,
      [userId],
    ),
    query(
      `SELECT id, user_agent AS "userAgent", ip_address::text AS "ipAddress", created_at AS "createdAt", expires_at AS "expiresAt", revoked_at AS "revokedAt"
       FROM sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId],
    ),
  ]);

  if (!settingsResult.rows.length) {
    await query(
      `INSERT INTO user_security_settings (user_id, created_at, updated_at)
       VALUES ($1, NOW(), NOW())
       ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );
  }
  const settings = settingsResult.rows[0] || {
    twoFactorEnabled: false,
    trustedDeviceDays: 0,
    primaryLoginMethod: 'PASSWORD',
    allowImageLogin: false,
    allowMessengerLogin: false,
    allowQrLogin: false,
  };
  const eventsResult = await query(
    `SELECT action, severity, created_at AS "createdAt", metadata
     FROM audit_logs
     WHERE user_id = $1
       AND action IN (
         'USER_LOGIN',
         'USER_LOGIN_FAILED',
         'USER_PASSWORD_CHANGE',
         'USER_PASSWORD_RESET_REQUEST',
         'USER_PASSWORD_RESET_CONFIRM',
         'USER_PASSWORD_RESET_CONFIRM',
         'USER_PASSWORD_RESET_REQUEST'
       )
     ORDER BY created_at DESC
     LIMIT 30`,
    [userId],
  );
  return res.json({
    twoFactorEnabled: Boolean(settings.twoFactorEnabled),
    trustedDeviceDays: Number(settings.trustedDeviceDays) || 0,
    primaryLoginMethod: settings.primaryLoginMethod || 'PASSWORD',
    allowImageLogin: Boolean(settings.allowImageLogin),
    allowMessengerLogin: Boolean(settings.allowMessengerLogin),
    allowQrLogin: Boolean(settings.allowQrLogin),
    sessions: sessionsResult.rows,
    events: eventsResult.rows,
  });
});

router.post('/security/settings', requireAuth, async (req, res) => {
  const userId = Number(req.user?.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(401).json({ message: 'Требуется аутентификация' });
  }
  const parsed = updateSecuritySettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    const issueMsg = parsed.error.issues.map((i) => i.message).filter(Boolean)[0];
    return res.status(400).json({ message: issueMsg ?? 'Неверные данные' });
  }

  const incoming = parsed.data;
  const currentResult = await query(
    `SELECT two_factor_enabled AS "twoFactorEnabled",
            primary_login_method AS "primaryLoginMethod",
            allow_image_login AS "allowImageLogin",
            allow_messenger_login AS "allowMessengerLogin",
            allow_qr_login AS "allowQrLogin"
     FROM user_security_settings
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );
  const current = currentResult.rows[0] || {
    twoFactorEnabled: false,
    primaryLoginMethod: 'PASSWORD',
    allowImageLogin: false,
    allowMessengerLogin: false,
    allowQrLogin: false,
  };
  const nextPrimary = incoming.primaryLoginMethod ?? current.primaryLoginMethod;
  if (nextPrimary === 'PASSWORD_TOTP' && !current.twoFactorEnabled) {
    return res.status(400).json({ message: 'Для входа с одноразовым кодом сначала включите 2FA' });
  }
  await query(
    `INSERT INTO user_security_settings (
       user_id, primary_login_method, allow_image_login, allow_messenger_login, allow_qr_login, created_at, updated_at
     )
     VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET
       primary_login_method = EXCLUDED.primary_login_method,
       allow_image_login = EXCLUDED.allow_image_login,
       allow_messenger_login = EXCLUDED.allow_messenger_login,
       allow_qr_login = EXCLUDED.allow_qr_login,
       updated_at = NOW()`,
    [
      userId,
      nextPrimary,
      incoming.allowImageLogin ?? current.allowImageLogin,
      incoming.allowMessengerLogin ?? current.allowMessengerLogin,
      incoming.allowQrLogin ?? current.allowQrLogin,
    ],
  );
  return res.json({ ok: true });
});

router.post('/security/sessions/revoke-all-others', requireAuth, async (req, res) => {
  const userId = Number(req.user?.id);
  const currentSessionId = req.user?.sessionId ? String(req.user.sessionId) : null;
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(401).json({ message: 'Требуется аутентификация' });
  }

  if (currentSessionId) {
    await query(
      `UPDATE sessions
       SET revoked_at = NOW()
       WHERE user_id = $1
         AND id::text <> $2
         AND revoked_at IS NULL`,
      [userId, currentSessionId],
    );
  } else {
    await query(
      `UPDATE sessions
       SET revoked_at = NOW()
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [userId],
    );
  }
  return res.json({ ok: true });
});

router.post('/security/sessions/revoke', requireAuth, async (req, res) => {
  const userId = Number(req.user?.id);
  const sessionId = String(req.body?.sessionId || '');
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(401).json({ message: 'Требуется аутентификация' });
  }
  if (!sessionId) {
    return res.status(400).json({ message: 'Не передан sessionId' });
  }
  await query(
    `UPDATE sessions
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND id::text = $2`,
    [userId, sessionId],
  );
  return res.json({ ok: true });
});

router.post('/security/change-password/request-confirmation', requireAuth, async (req, res) => {
  try {
    const parsed = requestSecurityPasswordChangeSchema.safeParse(req.body);
    if (!parsed.success) {
      const issueMsg = parsed.error.issues.map((i) => i.message).filter(Boolean)[0];
      return res.status(400).json({ message: issueMsg ?? 'Неверные данные' });
    }
    const userId = Number(req.user?.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ message: 'Требуется аутентификация' });
    }
    const { oldPassword, newPassword } = parsed.data;
    const userResult = await query(
      `SELECT email, password_hash
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );
    if (!userResult.rows.length) {
      return res.status(401).json({ message: 'Пользователь не найден' });
    }
    const user = userResult.rows[0];
    const isValid = await verifyPassword(user.password_hash, oldPassword);
    if (!isValid) {
      return res.status(401).json({ message: 'Неверный старый пароль' });
    }

    const now = new Date();
    const existingToken = await query(
      `SELECT id, last_sent_at AS "lastSentAt"
       FROM email_action_tokens
       WHERE user_id = $1 AND action_type = 'CHANGE_PASSWORD' AND consumed_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );
    if (existingToken.rows.length) {
      const lastSentAt = new Date(existingToken.rows[0].lastSentAt);
      if (now.getTime() - lastSentAt.getTime() < 60_000) {
        return res.status(429).json({ message: 'Повторный запрос возможен через 60 секунд' });
      }
    }

    const verificationCode = generateVerificationCode();
    const newPasswordHash = await hashPassword(newPassword);
    await query(
      `UPDATE email_action_tokens
       SET consumed_at = NOW()
       WHERE user_id = $1
         AND action_type = 'CHANGE_PASSWORD'
         AND consumed_at IS NULL`,
      [userId],
    );
    await query(
      `INSERT INTO email_action_tokens (user_id, action_type, token_hash, metadata, expires_at, created_at, last_sent_at)
       VALUES ($1,'CHANGE_PASSWORD',$2,$3,$4,$5,$5)`,
      [userId, hashVerificationCode(verificationCode), JSON.stringify({ newPasswordHash }), new Date(now.getTime() + 10 * 60 * 1000).toISOString(), now.toISOString()],
    );

    await sendSecurityCodeEmail({ email: user.email, code: verificationCode, actionLabel: 'Смена пароля' });
    void sendSecurityEventEmail({
      email: user.email,
      subject: 'Запрошена смена пароля',
      text: 'Кто-то запросил смену пароля в вашем аккаунте. Если это не вы — немедленно выйдите из всех сессий.',
    });
    return res.json({ ok: true, message: 'Код подтверждения отправлен на email' });
  } catch (err) {
    console.error('security change-password request error:', err);
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Ошибка отправки кода' });
  }
});

router.post('/security/change-password/confirm', requireAuth, async (req, res) => {
  try {
    const parsed = confirmSecurityPasswordChangeSchema.safeParse(req.body);
    if (!parsed.success) {
      const issueMsg = parsed.error.issues.map((i) => i.message).filter(Boolean)[0];
      return res.status(400).json({ message: issueMsg ?? 'Неверные данные' });
    }
    const userId = Number(req.user?.id);
    const currentSessionId = req.user?.sessionId ? String(req.user.sessionId) : null;
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ message: 'Требуется аутентификация' });
    }

    const tokenResult = await query(
      `SELECT id, token_hash AS "tokenHash", metadata, expires_at AS "expiresAt", consumed_at AS "consumedAt"
       FROM email_action_tokens
       WHERE user_id = $1
         AND action_type = 'CHANGE_PASSWORD'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );
    if (!tokenResult.rows.length) {
      return res.status(400).json({ message: 'Код недействителен или истек' });
    }
    const row = tokenResult.rows[0];
    if (row.consumedAt || new Date(row.expiresAt) < new Date()) {
      return res.status(400).json({ message: 'Код недействителен или истек' });
    }
    if (hashVerificationCode(parsed.data.code) !== row.tokenHash) {
      return res.status(400).json({ message: 'Неверный код подтверждения' });
    }
    const newPasswordHash = row.metadata?.newPasswordHash;
    if (!newPasswordHash) {
      return res.status(400).json({ message: 'Код недействителен или истек' });
    }

    await query(
      `UPDATE users
       SET password_hash = $2, updated_at = NOW()
       WHERE id = $1`,
      [userId, newPasswordHash],
    );
    await query(
      `UPDATE email_action_tokens
       SET consumed_at = NOW()
       WHERE id = $1`,
      [row.id],
    );
    if (currentSessionId) {
      await query(
        `UPDATE sessions
         SET revoked_at = NOW()
         WHERE user_id = $1 AND revoked_at IS NULL AND id::text <> $2`,
        [userId, currentSessionId],
      );
    } else {
      await query(
        `UPDATE sessions
         SET revoked_at = NOW()
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId],
      );
    }
    await createAuditLog({
      req,
      action: 'USER_PASSWORD_CHANGE',
      entityType: 'USER',
      entityId: String(userId),
      severity: 'INFO',
      metadata: { via: 'EMAIL_CONFIRM' },
    });
    const emailResult = await query('SELECT email FROM users WHERE id = $1 LIMIT 1', [userId]);
    if (emailResult.rows.length) {
      void sendSecurityEventEmail({
        email: emailResult.rows[0].email,
        subject: 'Пароль успешно изменен',
        text: 'Пароль вашего аккаунта был изменен. Если это были не вы — немедленно восстановите доступ.',
      });
    }
    return res.json({ ok: true, message: 'Пароль успешно изменен' });
  } catch (err) {
    console.error('security change-password confirm error:', err);
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Ошибка подтверждения смены пароля' });
  }
});

router.post('/security/2fa/setup', requireAuth, async (req, res) => {
  const userId = Number(req.user?.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(401).json({ message: 'Требуется аутентификация' });
  }
  const secret = generateTotpSecret();
  await query(
    `INSERT INTO user_security_settings (user_id, two_factor_enabled, two_factor_secret_enc, created_at, updated_at)
     VALUES ($1,FALSE,$2,NOW(),NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET two_factor_secret_enc = EXCLUDED.two_factor_secret_enc, two_factor_enabled = FALSE, updated_at = NOW()`,
    [userId, encryptValue(secret)],
  );
  const emailResult = await query('SELECT email FROM users WHERE id = $1 LIMIT 1', [userId]);
  const email = emailResult.rows[0]?.email || 'user@example.com';
  const appName = encodeURIComponent(process.env.TOTP_ISSUER || 'Moinoviichistiimir');
  const otpauthUrl = `otpauth://totp/${appName}:${encodeURIComponent(email)}?secret=${secret}&issuer=${appName}&algorithm=SHA1&digits=6&period=30`;
  return res.json({ secret, otpauthUrl });
});

router.get('/security/2fa/qr', requireAuth, async (req, res) => {
  try {
    const otpauth = String(req.query.otpauth || '').trim();
    if (!otpauth.startsWith('otpauth://')) {
      return res.status(400).json({ message: 'Некорректный параметр otpauth' });
    }

    const upstream = `https://quickchart.io/qr?size=220&text=${encodeURIComponent(otpauth)}`;
    const response = await fetch(upstream);
    if (!response.ok) {
      return res.status(502).json({ message: 'Не удалось сгенерировать QR-код' });
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(imageBuffer);
  } catch (err) {
    console.error('2fa qr error:', err);
    return res.status(500).json({ message: 'Ошибка генерации QR-кода' });
  }
});

router.post('/security/2fa/enable', requireAuth, async (req, res) => {
  const parsed = setup2faEnableSchema.safeParse(req.body);
  if (!parsed.success) {
    const issueMsg = parsed.error.issues.map((i) => i.message).filter(Boolean)[0];
    return res.status(400).json({ message: issueMsg ?? 'Неверные данные' });
  }
  const userId = Number(req.user?.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(401).json({ message: 'Требуется аутентификация' });
  }
  const settingsResult = await query(
    `SELECT two_factor_secret_enc AS "secretEnc"
     FROM user_security_settings
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );
  if (!settingsResult.rows.length || !settingsResult.rows[0].secretEnc) {
    return res.status(400).json({ message: 'Сначала выполните настройку 2FA' });
  }
  const secret = decryptValue(settingsResult.rows[0].secretEnc);
  if (!verifyTotpCode(secret, parsed.data.totpCode)) {
    return res.status(400).json({ message: 'Неверный код приложения' });
  }

  const recoveryCodes = generateRecoveryCodes();
  await query('DELETE FROM two_factor_recovery_codes WHERE user_id = $1', [userId]);
  for (const code of recoveryCodes) {
    await query(
      `INSERT INTO two_factor_recovery_codes (user_id, code_hash)
       VALUES ($1,$2)`,
      [userId, hashOneTimeToken(code)],
    );
  }
  await query(
    `UPDATE user_security_settings
     SET two_factor_enabled = TRUE, two_factor_enabled_at = NOW(), updated_at = NOW()
     WHERE user_id = $1`,
    [userId],
  );
  const userEmail = await query('SELECT email FROM users WHERE id = $1 LIMIT 1', [userId]);
  if (userEmail.rows.length) {
    void sendSecurityEventEmail({
      email: userEmail.rows[0].email,
      subject: '2FA включен',
      text: 'Двухфакторная аутентификация успешно включена для вашего аккаунта.',
    });
  }
  return res.json({ ok: true, recoveryCodes });
});

router.post('/security/2fa/disable', requireAuth, async (req, res) => {
  const parsed = disable2faSchema.safeParse(req.body);
  if (!parsed.success) {
    const issueMsg = parsed.error.issues.map((i) => i.message).filter(Boolean)[0];
    return res.status(400).json({ message: issueMsg ?? 'Неверные данные' });
  }
  const userId = Number(req.user?.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(401).json({ message: 'Требуется аутентификация' });
  }
  const settingsResult = await query(
    `SELECT two_factor_secret_enc AS "secretEnc", two_factor_enabled AS "enabled"
     FROM user_security_settings
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );
  if (!settingsResult.rows.length || !settingsResult.rows[0].enabled) {
    return res.status(400).json({ message: '2FA уже отключен' });
  }
  let ok = false;
  if (parsed.data.totpCode) {
    const secret = decryptValue(settingsResult.rows[0].secretEnc);
    ok = verifyTotpCode(secret, parsed.data.totpCode);
  }
  if (!ok && parsed.data.recoveryCode) {
    const recoveryHash = hashOneTimeToken(parsed.data.recoveryCode.toUpperCase());
    const consumeRecoveryResult = await query(
      `UPDATE two_factor_recovery_codes
       SET consumed_at = NOW()
       WHERE user_id = $1
         AND code_hash = $2
         AND consumed_at IS NULL
       RETURNING id`,
      [userId, recoveryHash],
    );
    ok = consumeRecoveryResult.rows.length > 0;
  }
  if (!ok) {
    return res.status(400).json({ message: 'Подтверждение 2FA не прошло' });
  }
  await query(
    `UPDATE user_security_settings
     SET two_factor_enabled = FALSE, updated_at = NOW()
     WHERE user_id = $1`,
    [userId],
  );
  await query('DELETE FROM two_factor_recovery_codes WHERE user_id = $1', [userId]);
  const userEmail = await query('SELECT email FROM users WHERE id = $1 LIMIT 1', [userId]);
  if (userEmail.rows.length) {
    void sendSecurityEventEmail({
      email: userEmail.rows[0].email,
      subject: '2FA отключен',
      text: 'Двухфакторная аутентификация была отключена для вашего аккаунта.',
    });
  }
  return res.json({ ok: true });
});

router.post('/security/2fa/recovery-codes/regenerate', requireAuth, async (req, res) => {
  const userId = Number(req.user?.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(401).json({ message: 'Требуется аутентификация' });
  }
  const recoveryCodes = generateRecoveryCodes();
  await query('DELETE FROM two_factor_recovery_codes WHERE user_id = $1', [userId]);
  for (const code of recoveryCodes) {
    await query(
      `INSERT INTO two_factor_recovery_codes (user_id, code_hash)
       VALUES ($1,$2)`,
      [userId, hashOneTimeToken(code)],
    );
  }
  return res.json({ ok: true, recoveryCodes });
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

    const securitySettingsResult = await query(
      `SELECT two_factor_enabled AS "twoFactorEnabled", primary_login_method AS "primaryLoginMethod"
       FROM user_security_settings
       WHERE user_id = $1
       LIMIT 1`,
      [user.id],
    );
    const twoFactorEnabled = Boolean(securitySettingsResult.rows[0]?.twoFactorEnabled);
    const primaryLoginMethod = securitySettingsResult.rows[0]?.primaryLoginMethod || 'PASSWORD';

    if (twoFactorEnabled && primaryLoginMethod === 'PASSWORD_TOTP') {
      const challengeToken = crypto.randomBytes(24).toString('hex');
      const challengeHash = hashOneTimeToken(challengeToken);
      const now = new Date();
      await query(
        `INSERT INTO login_challenges (user_id, challenge_hash, expires_at, created_at)
         VALUES ($1,$2,$3,$4)`,
        [user.id, challengeHash, new Date(now.getTime() + 10 * 60 * 1000).toISOString(), now.toISOString()],
      );
      return res.json({
        requiresTwoFactor: true,
        challengeToken,
      });
    }

    const loggedInUser = await completeLogin({ user, req, res });
    void sendSecurityEventEmail({
      email: user.email,
      subject: 'Новый вход в аккаунт',
      text: `Обнаружен вход в аккаунт. IP: ${getClientIp(req) || 'unknown'}, device: ${(req.headers['user-agent'] || '').toString() || 'unknown'}`,
    });

    await createAuditLog({
      req,
      action: 'USER_LOGIN',
      entityType: 'USER',
      entityId: String(user.id),
      severity: 'INFO',
      metadata: { sessionId: req.user?.sessionId || null, twoFactor: false },
    });

    return res.json({
      user: loggedInUser,
    });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Ошибка входа',
    });
  }
});

router.post('/login/2fa', async (req, res) => {
  try {
    const parsed = login2faSchema.safeParse(req.body);
    if (!parsed.success) {
      const issueMsg = parsed.error.issues.map((i) => i.message).filter(Boolean)[0];
      return res.status(400).json({ message: issueMsg ?? 'Неверные данные' });
    }
    const { challengeToken, totpCode, recoveryCode } = parsed.data;
    if (!totpCode && !recoveryCode) {
      return res.status(400).json({ message: 'Передайте totpCode или recoveryCode' });
    }
    const challengeHash = hashOneTimeToken(challengeToken);
    const challengeResult = await query(
      `SELECT c.id, c.user_id AS "userId", c.expires_at AS "expiresAt", c.consumed_at AS "consumedAt",
              u.email, u.full_name AS "fullName", u.role, u.is_active AS "isActive",
              s.two_factor_secret_enc AS "secretEnc", s.two_factor_enabled AS "twoFactorEnabled"
       FROM login_challenges c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN user_security_settings s ON s.user_id = c.user_id
       WHERE c.challenge_hash = $1
       LIMIT 1`,
      [challengeHash],
    );
    if (!challengeResult.rows.length) {
      return res.status(400).json({ message: 'Челлендж недействителен или истек' });
    }
    const row = challengeResult.rows[0];
    if (!row.isActive || row.consumedAt || new Date(row.expiresAt) < new Date() || !row.twoFactorEnabled) {
      return res.status(400).json({ message: 'Челлендж недействителен или истек' });
    }

    let verified = false;
    if (totpCode) {
      const secret = decryptValue(row.secretEnc);
      verified = verifyTotpCode(secret, totpCode);
    }
    if (!verified && recoveryCode) {
      const recoveryHash = hashOneTimeToken(recoveryCode.toUpperCase());
      const consumeRecovery = await query(
        `UPDATE two_factor_recovery_codes
         SET consumed_at = NOW()
         WHERE user_id = $1 AND code_hash = $2 AND consumed_at IS NULL
         RETURNING id`,
        [row.userId, recoveryHash],
      );
      verified = consumeRecovery.rows.length > 0;
    }
    if (!verified) {
      return res.status(401).json({ message: 'Неверный код 2FA' });
    }

    await query(
      `UPDATE login_challenges
       SET consumed_at = NOW()
       WHERE id = $1`,
      [row.id],
    );

    const user = await completeLogin({
      user: { id: row.userId, email: row.email, fullName: row.fullName, role: row.role },
      req,
      res,
    });
    void sendSecurityEventEmail({
      email: row.email,
      subject: 'Новый вход в аккаунт (2FA)',
      text: `Вход в аккаунт подтвержден через 2FA. IP: ${getClientIp(req) || 'unknown'}`,
    });
    return res.json({ user });
  } catch (err) {
    console.error('login 2fa error:', err);
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Ошибка 2FA входа' });
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

