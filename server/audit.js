import { query } from './db.js';

export async function createAuditLog({
  req,
  userId,
  sessionId,
  action,
  entityType,
  entityId,
  severity = 'INFO',
  changes,
  metadata,
}) {
  try {
    const uid = userId ?? req?.user?.id ?? null;
    const sid = sessionId ?? req?.user?.sessionId ?? null;
    const rawIp = (req?.headers['x-forwarded-for'] || req?.ip || '').toString();
    const ip = rawIp.split(',')[0].trim() || null;
    const ua = (req?.headers['user-agent'] || '').toString();

    await query(
      `INSERT INTO audit_logs
       (user_id, session_id, action, entity_type, entity_id, severity, ip_address, user_agent, changes, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [uid, sid, action, entityType, entityId, severity, ip, ua, changes ?? null, metadata ?? null],
    );
  } catch (err) {
    // не ломаем основной поток из-за логов
    console.error('audit log error:', err);
  }
}

