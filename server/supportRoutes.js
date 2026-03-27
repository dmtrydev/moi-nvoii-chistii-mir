import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdirSync, existsSync } from 'node:fs';
import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { query } from './db.js';
import { requireAuth } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads', 'support');
mkdirSync(uploadsDir, { recursive: true });

const router = express.Router();

const supportUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (String(file.mimetype || '').startsWith('image/')) return cb(null, true);
    return cb(new Error('Разрешены только изображения'));
  },
});

async function ensureConversationForUser(userId) {
  const existing = await query(
    `SELECT id, user_id AS "userId", status, subject, last_message_at AS "lastMessageAt", created_at AS "createdAt"
     FROM support_conversations
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );
  if (existing.rows.length) return existing.rows[0];
  const inserted = await query(
    `INSERT INTO support_conversations (user_id, status, subject, last_message_at)
     VALUES ($1, 'open', 'Обращение в поддержку', NOW())
     RETURNING id, user_id AS "userId", status, subject, last_message_at AS "lastMessageAt", created_at AS "createdAt"`,
    [userId],
  );
  return inserted.rows[0];
}

async function resolveTelegramChatId(botToken) {
  const explicit = String(process.env.TELEGRAM_ADMIN_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID ?? '').trim();
  if (explicit) return explicit;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/getUpdates?limit=20`);
    if (!resp.ok) return '';
    const data = await resp.json();
    const results = Array.isArray(data?.result) ? data.result : [];
    for (let i = results.length - 1; i >= 0; i -= 1) {
      const id =
        results[i]?.message?.chat?.id ??
        results[i]?.my_chat_member?.chat?.id ??
        results[i]?.channel_post?.chat?.id;
      if (id != null) return String(id);
    }
    return '';
  } catch {
    return '';
  }
}

async function sendTelegramNotification(text) {
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
  if (!botToken) return;
  const chatId = await resolveTelegramChatId(botToken);
  if (!chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
  } catch {
    // noop
  }
}

async function canAccessConversation(reqUser, conversationId) {
  const rows = await query(
    `SELECT id, user_id AS "userId"
     FROM support_conversations
     WHERE id = $1
     LIMIT 1`,
    [conversationId],
  );
  if (!rows.rows.length) return { ok: false, reason: 'not_found' };
  const convo = rows.rows[0];
  const isAdmin = reqUser?.role === 'SUPERADMIN';
  const isOwner = Number(convo.userId) === Number(reqUser?.id);
  if (!isAdmin && !isOwner) return { ok: false, reason: 'forbidden' };
  return { ok: true, conversation: convo, isAdmin, isOwner };
}

router.use(requireAuth);

router.get('/conversations/mine', async (req, res) => {
  try {
    const userId = Number(req.user?.id);
    const convo = await ensureConversationForUser(userId);
    return res.json({ conversation: convo });
  } catch (err) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Ошибка чата' });
  }
});

router.get('/conversations', async (req, res) => {
  try {
    if (req.user?.role !== 'SUPERADMIN') {
      return res.status(403).json({ message: 'Недостаточно прав' });
    }
    const rows = await query(
      `SELECT c.id,
              c.user_id AS "userId",
              c.status,
              c.subject,
              c.last_message_at AS "lastMessageAt",
              c.created_at AS "createdAt",
              u.email AS "userEmail",
              u.full_name AS "userFullName",
              (
                SELECT COUNT(*)::int
                FROM support_messages m
                WHERE m.conversation_id = c.id
                  AND m.author_role = 'USER'
                  AND m.read_by_admin = FALSE
              ) AS "unreadForAdmin"
       FROM support_conversations c
       JOIN users u ON u.id = c.user_id
       ORDER BY c.last_message_at DESC, c.id DESC`,
      [],
    );
    return res.json({ items: rows.rows });
  } catch (err) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Ошибка чата' });
  }
});

router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    if (!Number.isFinite(conversationId) || conversationId <= 0) {
      return res.status(400).json({ message: 'Некорректный conversation id' });
    }
    const access = await canAccessConversation(req.user, conversationId);
    if (!access.ok) {
      return res.status(access.reason === 'not_found' ? 404 : 403).json({ message: 'Доступ запрещён' });
    }
    const rows = await query(
      `SELECT m.id,
              m.conversation_id AS "conversationId",
              m.author_user_id AS "authorUserId",
              m.author_role AS "authorRole",
              m.body_text AS "bodyText",
              m.attachment_original_name AS "attachmentOriginalName",
              m.attachment_mime AS "attachmentMime",
              m.created_at AS "createdAt",
              u.email AS "authorEmail",
              u.full_name AS "authorFullName"
       FROM support_messages m
       JOIN users u ON u.id = m.author_user_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC, m.id ASC`,
      [conversationId],
    );
    return res.json({ items: rows.rows });
  } catch (err) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Ошибка чата' });
  }
});

router.post('/conversations/:id/messages', supportUpload.single('attachment'), async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    if (!Number.isFinite(conversationId) || conversationId <= 0) {
      return res.status(400).json({ message: 'Некорректный conversation id' });
    }
    const access = await canAccessConversation(req.user, conversationId);
    if (!access.ok) {
      return res.status(access.reason === 'not_found' ? 404 : 403).json({ message: 'Доступ запрещён' });
    }
    const bodyTextRaw = String(req.body?.text ?? '').trim();
    const bodyText = bodyTextRaw ? bodyTextRaw.slice(0, 4000) : null;
    const file = req.file ?? null;
    if (!bodyText && !file) {
      return res.status(400).json({ message: 'Добавьте текст или скриншот' });
    }

    const authorRole = req.user?.role === 'SUPERADMIN' ? 'ADMIN' : 'USER';
    const inserted = await query(
      `INSERT INTO support_messages
        (conversation_id, author_user_id, author_role, body_text, attachment_path, attachment_original_name, attachment_mime, read_by_user, read_by_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        conversationId,
        Number(req.user?.id),
        authorRole,
        bodyText,
        file?.filename ?? null,
        file?.originalname ?? null,
        file?.mimetype ?? null,
        authorRole === 'USER' ? false : true,
        authorRole === 'ADMIN' ? false : true,
      ],
    );

    await query(
      `UPDATE support_conversations
       SET last_message_at = NOW(),
           status = 'open'
       WHERE id = $1`,
      [conversationId],
    );

    if (authorRole === 'USER') {
      const lines = [
        'Новое сообщение в поддержке',
        `Пользователь ID: ${access.conversation.userId}`,
        `Conversation ID: ${conversationId}`,
      ];
      if (bodyText) lines.push(`Текст: ${bodyText.slice(0, 600)}`);
      if (file?.originalname) lines.push(`Вложение: ${file.originalname}`);
      await sendTelegramNotification(lines.join('\n'));
    }

    return res.status(201).json({ id: inserted.rows[0]?.id ?? null });
  } catch (err) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Ошибка отправки' });
  }
});

router.post('/conversations/:id/read', async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    if (!Number.isFinite(conversationId) || conversationId <= 0) {
      return res.status(400).json({ message: 'Некорректный conversation id' });
    }
    const access = await canAccessConversation(req.user, conversationId);
    if (!access.ok) {
      return res.status(access.reason === 'not_found' ? 404 : 403).json({ message: 'Доступ запрещён' });
    }
    if (access.isAdmin) {
      await query(
        `UPDATE support_messages
         SET read_by_admin = TRUE
         WHERE conversation_id = $1`,
        [conversationId],
      );
    } else {
      await query(
        `UPDATE support_messages
         SET read_by_user = TRUE
         WHERE conversation_id = $1`,
        [conversationId],
      );
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Ошибка отметки прочтения' });
  }
});

router.get('/messages/:id/attachment', async (req, res) => {
  try {
    const messageId = Number(req.params.id);
    if (!Number.isFinite(messageId) || messageId <= 0) {
      return res.status(400).json({ message: 'Некорректный message id' });
    }
    const rows = await query(
      `SELECT m.id,
              m.conversation_id AS "conversationId",
              m.attachment_path AS "attachmentPath",
              m.attachment_original_name AS "attachmentOriginalName",
              m.attachment_mime AS "attachmentMime"
       FROM support_messages m
       WHERE m.id = $1
       LIMIT 1`,
      [messageId],
    );
    if (!rows.rows.length) return res.status(404).json({ message: 'Вложение не найдено' });
    const msg = rows.rows[0];
    if (!msg.attachmentPath) return res.status(404).json({ message: 'Вложение не найдено' });

    const access = await canAccessConversation(req.user, Number(msg.conversationId));
    if (!access.ok) {
      return res.status(access.reason === 'not_found' ? 404 : 403).json({ message: 'Доступ запрещён' });
    }

    const filePath = path.join(uploadsDir, String(msg.attachmentPath));
    if (!existsSync(filePath)) return res.status(404).json({ message: 'Файл не найден' });
    if (msg.attachmentMime) res.setHeader('Content-Type', msg.attachmentMime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(msg.attachmentOriginalName || 'attachment')}`,
    );
    return res.sendFile(filePath);
  } catch (err) {
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Ошибка вложения' });
  }
});

export default router;
