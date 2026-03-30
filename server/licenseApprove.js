/**
 * Одобрение/отклонение лицензии внутри открытой транзакции (client.query BEGIN уже выполнен).
 */

export class ApproveLicenseError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export async function approveLicenseInTx(client, licenseId, adminId) {
  const beforeResult = await client.query(
    `SELECT id,
            status,
            reward,
            owner_user_id AS "ownerUserId",
            rejection_note AS "rejectionNote"
     FROM licenses
     WHERE id = $1
     FOR UPDATE`,
    [licenseId],
  );
  if (!beforeResult.rows.length) {
    throw new ApproveLicenseError('NOT_FOUND', 'Объект не найден');
  }
  const before = beforeResult.rows[0];
  if (before.status === 'approved') {
    throw new ApproveLicenseError('ALREADY_APPROVED', 'Лицензия уже одобрена');
  }
  if (before.status !== 'pending') {
    throw new ApproveLicenseError('NOT_PENDING', 'Лицензия не в статусе «на проверке»');
  }
  if (!before.ownerUserId) {
    throw new ApproveLicenseError('NO_OWNER', 'У лицензии нет владельца для начисления экокоинов');
  }

  const updated = await client.query(
    `UPDATE licenses
     SET status = 'approved',
         moderated_by = $2,
         moderated_at = NOW(),
         moderated_comment = COALESCE(moderated_comment, ''),
         rejection_note = NULL
     WHERE id = $1
     RETURNING id,
               status,
               reward,
               owner_user_id AS "ownerUserId",
               moderated_at AS "moderatedAt",
               moderated_by AS "moderatedBy"`,
    [licenseId, adminId ?? null],
  );

  const txInsert = await client.query(
    `INSERT INTO transactions (user_id, license_id, amount, type)
     VALUES ($1, $2, $3, 'LICENSE_REWARD')
     ON CONFLICT (license_id) DO NOTHING
     RETURNING id`,
    [before.ownerUserId, licenseId, Number(before.reward ?? 100)],
  );

  if (txInsert.rowCount > 0) {
    await client.query(
      `UPDATE users
       SET eco_coins = eco_coins + $2
       WHERE id = $1`,
      [before.ownerUserId, Number(before.reward ?? 100)],
    );
  }

  return {
    before,
    after: updated.rows[0],
    rewardGranted: txInsert.rowCount > 0,
  };
}

export async function rejectLicenseInTx(client, licenseId, adminId, note) {
  const noteStr = String(note ?? 'Причина не указана').trim().slice(0, 1000) || 'Причина не указана';
  const updated = await client.query(
    `UPDATE licenses
     SET status = 'rejected',
         moderated_by = $2,
         moderated_at = NOW(),
         moderated_comment = $3,
         rejection_note = $3
     WHERE id = $1
       AND deleted_at IS NULL
       AND status = 'pending'
     RETURNING id,
               status,
               reward,
               rejection_note AS "rejectionNote",
               moderated_comment AS "moderatedComment",
               moderated_at AS "moderatedAt",
               moderated_by AS "moderatedBy"`,
    [licenseId, adminId ?? null, noteStr],
  );
  if (!updated.rows.length) {
    throw new ApproveLicenseError('NOT_FOUND', 'Объект не найден или удалён');
  }
  return updated.rows[0];
}
