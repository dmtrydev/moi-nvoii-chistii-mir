/**
 * Создать тестового пользователя (роль USER) в БД.
 * Запуск из папки server:
 *   node scripts/create-test-user.js "email@example.com" "Password123!" "Имя Фамилия"
 *
 * Скрипт idempotent: если email уже существует, обновит пароль/фио.
 */
import 'dotenv/config';
import { query } from '../db.js';
import { hashPassword } from '../auth.js';

function arg(i, fallback) {
  const v = process.argv[i];
  if (v == null) return fallback;
  return v;
}

async function main() {
  const email = String(arg(2, '') ?? '').trim();
  const password = String(arg(3, '') ?? '').trim();
  const fullName = String(arg(4, 'Тестовый Пользователь') ?? '').trim();
  const role = String(arg(5, 'USER') ?? '').trim().toUpperCase();

  if (!email || !/.+@.+\..+/.test(email)) {
    console.error('Нужен корректный email: node scripts/create-test-user.js "email" "password" "fullName"');
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error('Нужен пароль длиной >= 8 символов');
    process.exit(1);
  }
  if (!['USER', 'MODERATOR', 'SUPERADMIN'].includes(role)) {
    console.error('Роль должна быть одной из: USER, MODERATOR, SUPERADMIN');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const rows = await query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           full_name = EXCLUDED.full_name,
           role = EXCLUDED.role
     RETURNING id, email, full_name AS "fullName", role`,
    [email, passwordHash, fullName, role],
  );

  const user = rows.rows[0];
  console.log('OK: user ready:', {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  });
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});

