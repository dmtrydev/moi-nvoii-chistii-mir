/**
 * Сборка JSON карточки лицензии как в GET /api/licenses/:id/extended (для ответа после PATCH).
 * @param {import('pg').PoolClient} client
 */
export async function fetchLicenseExtendedJson(client, id) {
  const rows = await client.query(
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
            owner_user_id AS "ownerUserId",
            rejection_note AS "rejectionNote",
            moderated_by AS "moderatedBy",
            moderated_at AS "moderatedAt",
            moderated_comment AS "moderatedComment",
            file_original_name AS "fileOriginalName",
            file_stored_name AS "fileStoredName",
            created_at AS "createdAt",
            import_source AS "importSource",
            import_external_ref AS "importExternalRef",
            import_needs_review AS "importNeedsReview",
            import_registry_inactive AS "importRegistryInactive"
     FROM licenses
     WHERE id = $1
       AND deleted_at IS NULL
     LIMIT 1`,
    [id],
  );

  if (!rows.rows.length) {
    return null;
  }

  const license = rows.rows[0];
  const sites = await client.query(
    `SELECT id,
            site_label AS "siteLabel",
            address,
            region,
            lat,
            lng,
            fkko_codes AS "fkkoCodes",
            activity_types AS "activityTypes",
            created_at AS "createdAt"
     FROM license_sites
     WHERE license_id = $1
     ORDER BY id ASC`,
    [id],
  );
  const siteIds = sites.rows.map((s) => s.id);
  const entriesMap = {};
  if (siteIds.length > 0) {
    const entriesRows = await client.query(
      `SELECT site_id AS "siteId",
              fkko_code AS "fkkoCode",
              waste_name AS "wasteName",
              hazard_class AS "hazardClass",
              activity_type AS "activityType"
       FROM site_fkko_activities
       WHERE site_id = ANY($1::bigint[])
       ORDER BY fkko_code, activity_type`,
      [siteIds],
    );
    for (const row of entriesRows.rows) {
      const key = `${row.siteId}_${row.fkkoCode}`;
      if (!entriesMap[key]) {
        entriesMap[key] = {
          siteId: row.siteId,
          fkkoCode: row.fkkoCode,
          wasteName: row.wasteName,
          hazardClass: row.hazardClass,
          activityTypes: [],
        };
      }
      entriesMap[key].activityTypes.push(row.activityType);
    }
  }
  const sitesWithEntries = sites.rows.map((s) => {
    const entries = Object.values(entriesMap)
      .filter((e) => e.siteId === s.id)
      .map(({ siteId: _s, ...rest }) => rest);
    return { ...s, entries };
  });
  return { ...license, sites: sitesWithEntries };
}
