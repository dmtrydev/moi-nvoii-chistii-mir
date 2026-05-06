import { normalizeInn } from './innUtils.js';

function unique(arr) {
  return [...new Set(arr)];
}

export async function upsertGroroObject(client, obj) {
  const innNorm = normalizeInn(obj.operatorInn);
  const linked = innNorm
    ? await client.query(
        `SELECT id
         FROM licenses
         WHERE deleted_at IS NULL
           AND regexp_replace(COALESCE(inn, ''), '[^0-9]', '', 'g') = $1
         ORDER BY id ASC
         LIMIT 1`,
        [innNorm],
      )
    : { rows: [] };
  const linkedLicenseId = linked.rows[0]?.id ?? null;

  const upsert = await client.query(
    `INSERT INTO groro_objects
      (source_object_id, groro_number, object_name, status, status_ru, region, operator_name, operator_inn, operator_address, linked_license_id, raw_payload)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
     ON CONFLICT (groro_number)
     DO UPDATE SET
      source_object_id = EXCLUDED.source_object_id,
      object_name = EXCLUDED.object_name,
      status = EXCLUDED.status,
      status_ru = EXCLUDED.status_ru,
      region = EXCLUDED.region,
      operator_name = EXCLUDED.operator_name,
      operator_inn = EXCLUDED.operator_inn,
      operator_address = EXCLUDED.operator_address,
      linked_license_id = EXCLUDED.linked_license_id,
      raw_payload = EXCLUDED.raw_payload,
      updated_at = NOW()
     RETURNING id, (xmax = 0) AS inserted`,
    [
      obj.sourceObjectId,
      obj.groroNumber,
      obj.objectName,
      obj.registryStatus,
      obj.registryStatusRu,
      obj.region,
      obj.operatorName,
      innNorm,
      obj.operatorAddress,
      linkedLicenseId,
      JSON.stringify(obj),
    ],
  );
  const groroObjectId = Number(upsert.rows[0].id);
  await client.query(`DELETE FROM groro_wastes WHERE groro_object_id = $1`, [groroObjectId]);
  const wastes = Array.isArray(obj.wastes) ? obj.wastes : [];
  for (const w of wastes) {
    const activities = unique(Array.isArray(w.activityTypes) ? w.activityTypes : ['Размещение']);
    for (const activityType of activities) {
      await client.query(
        `INSERT INTO groro_wastes (groro_object_id, fkko_code, waste_name, hazard_class, activity_type)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (groro_object_id, fkko_code, activity_type, waste_name)
         DO NOTHING`,
        [groroObjectId, w.fkkoCode, w.wasteName ?? null, w.hazardClass ?? null, activityType],
      );
    }
  }
  return { id: groroObjectId, inserted: Boolean(upsert.rows[0].inserted) };
}

export async function listGroroObjectsForMap(pool, { region = '', fkko = '' } = {}) {
  const params = [];
  let pi = 1;
  const where = [];
  if (region) {
    where.push(`o.region = $${pi++}`);
    params.push(region);
  }
  if (fkko) {
    where.push(`EXISTS (SELECT 1 FROM groro_wastes w2 WHERE w2.groro_object_id = o.id AND w2.fkko_code = $${pi++})`);
    params.push(fkko);
  }
  const sql = `
    SELECT
      o.id,
      o.groro_number AS "groroNumber",
      o.object_name AS "objectName",
      o.status,
      o.status_ru AS "statusRu",
      o.region,
      o.operator_name AS "operatorName",
      o.operator_inn AS "operatorInn",
      o.operator_address AS "operatorAddress",
      o.linked_license_id AS "linkedLicenseId",
      COALESCE(
        json_agg(
          json_build_object(
            'fkkoCode', w.fkko_code,
            'wasteName', w.waste_name,
            'hazardClass', w.hazard_class,
            'activityType', w.activity_type
          )
        ) FILTER (WHERE w.id IS NOT NULL),
        '[]'::json
      ) AS wastes
    FROM groro_objects o
    LEFT JOIN groro_wastes w ON w.groro_object_id = o.id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    GROUP BY o.id
    ORDER BY o.updated_at DESC
    LIMIT 5000
  `;
  const out = await pool.query(sql, params);
  return out.rows;
}

