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
  if (before.status !== 'pending' && before.status !== 'rejected' && before.status !== 'recheck') {
    throw new ApproveLicenseError(
      'NOT_PENDING',
      'Лицензия не в статусе «на проверке», «на перепроверке» или «отклонено»',
    );
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

  return {
    before,
    after: updated.rows[0],
    rewardGranted: false,
    manualOverrideFromRejected: before.status === 'rejected',
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
