import { normalizeFkkoCode, parseFkkoInput } from './fkkoServer.js';

export function parseActivityTypesInput(v) {
  if (v == null) return [];
  if (Array.isArray(v)) {
    return v.map((x) => String(x ?? '').trim()).filter(Boolean);
  }
  const s = String(v).trim();
  if (!s) return [];
  return s.split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
}

export function normalizeEntriesInput(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const e of v) {
    const fkkoRaw = String(e?.fkkoCode ?? e?.fkko_code ?? '').trim();
    const fkkoCode = normalizeFkkoCode(fkkoRaw);
    if (!fkkoCode || !/^\d{11}$/.test(fkkoCode)) continue;
    const wasteName = String(e?.wasteName ?? e?.waste_name ?? '').trim() || null;
    const hazardClass = String(e?.hazardClass ?? e?.hazard_class ?? '').trim() || null;
    const activityTypes = parseActivityTypesInput(e?.activityTypes ?? e?.activity_types);
    if (activityTypes.length === 0) continue;
    out.push({ fkkoCode, wasteName, hazardClass, activityTypes });
  }
  return out;
}

export function normalizeSitesInput(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const it of v) {
    const address = String(it?.address ?? '').trim();
    const region = it?.region == null ? null : String(it.region).trim() || null;
    const siteLabel = it?.siteLabel == null ? null : String(it.siteLabel).trim() || null;
    const lat = it?.lat == null || it.lat === '' ? null : Number(it.lat);
    const lng = it?.lng == null || it.lng === '' ? null : Number(it.lng);
    const entries = normalizeEntriesInput(it?.entries);
    const fkkoCodes = entries.length > 0
      ? [...new Set(entries.map((e) => e.fkkoCode))]
      : parseFkkoInput(it?.fkkoCodes);
    const activityTypes = entries.length > 0
      ? [...new Set(entries.flatMap((e) => e.activityTypes))]
      : parseActivityTypesInput(it?.activityTypes);
    if (!address && fkkoCodes.length === 0 && activityTypes.length === 0) continue;
    out.push({
      address: address || null,
      region,
      siteLabel,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      fkkoCodes,
      activityTypes,
      entries,
    });
  }
  return out;
}

/** Объединённые коды ФККО и виды работ по всем площадкам (для строки licenses). */
export function aggregateFkkoAndActivityFromSites(sitesArr) {
  const fkkoArr = [...new Set(sitesArr.flatMap((s) => s.fkkoCodes || []))];
  const activityArr = [...new Set(sitesArr.flatMap((s) => s.activityTypes || []))];
  return { fkkoArr, activityArr };
}

/**
 * Нормализация площадок из тела запроса админа; сохраняет положительный `id` как `clientId`.
 */
export function normalizeAdminSitesWithIds(rawSites) {
  if (!Array.isArray(rawSites)) return [];
  const out = [];
  for (const it of rawSites) {
    const batch = normalizeSitesInput([it]);
    const single = batch[0];
    if (!single) continue;
    const idRaw = it?.id;
    const sid = idRaw == null || idRaw === '' ? null : Number(idRaw);
    out.push({
      ...single,
      clientId: Number.isFinite(sid) && sid > 0 ? sid : null,
    });
  }
  return out;
}
