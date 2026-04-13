import express from 'express';
import { query } from './db.js';
import { requireAuth } from './auth.js';

const userRouter = express.Router();

userRouter.use(requireAuth);

userRouter.get('/balance', async (_req, res) => {
  return res.json({ balance: 0 });
});

userRouter.get('/licenses', async (req, res) => {
  const userId = Number(req.user?.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(401).json({ message: 'Требуется аутентификация' });
  }

  const result = await query(
    `SELECT id,
            company_name AS "companyName",
            inn,
            address,
            region,
            lat,
            lng,
            fkko_codes AS "fkkoCodes",
            activity_types AS "activityTypes",
            status,
            reward,
            rejection_note AS "rejectionNote",
            moderated_comment AS "moderatedComment",
            moderated_at AS "moderatedAt",
            file_original_name AS "fileOriginalName",
            file_stored_name AS "fileStoredName",
            created_at AS "createdAt"
     FROM licenses
     WHERE owner_user_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [userId],
  );

  return res.json({ items: result.rows });
});

userRouter.get('/transactions', async (_req, res) => {
  return res.json({ items: [] });
});

export default userRouter;
