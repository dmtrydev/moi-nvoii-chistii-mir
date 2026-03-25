import type { PkkFeatureDetailResponse, PkkIdentifyResponse } from '@/types/cadastre';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const LABELS: Record<string, string> = {
  cn: 'Кадастровый номер',
  cad_num: 'Кадастровый номер',
  address: 'Адрес',
  statecd: 'Статус',
  category: 'Категория земель',
  category_type: 'Категория земель',
  area_value: 'Площадь',
  cad_cost: 'Кадастровая стоимость',
  util_by_doc: 'Использование',
  fp: 'Форма собственности',
};

function pickRows(attrs: Record<string, string | number | null | undefined>): [string, string][] {
  const order = ['cn', 'cad_num', 'statecd', 'address', 'category', 'category_type', 'fp', 'area_value', 'cad_cost'];
  const seen = new Set<string>();
  const rows: [string, string][] = [];
  for (const k of order) {
    const v = attrs[k];
    if (v != null && String(v).trim() !== '') {
      rows.push([LABELS[k] ?? k, String(v)]);
      seen.add(k);
    }
  }
  for (const [k, v] of Object.entries(attrs)) {
    if (seen.has(k)) continue;
    if (v == null || String(v).trim() === '') continue;
    if (k === 'id' || k === 'type') continue;
    rows.push([LABELS[k] ?? k, String(v)]);
  }
  return rows.slice(0, 24);
}

export function buildCadastrePopupHtmlFromIdentify(data: PkkIdentifyResponse): string | null {
  if (Number(data.status) !== 200 || !Array.isArray(data.features) || data.features.length === 0) {
    return null;
  }
  const f = data.features[0];
  const attrs = f.attrs ?? {};
  const title = 'Земельный участок';
  return buildTableHtml(title, attrs);
}

export function buildCadastrePopupHtmlFromFeature(data: PkkFeatureDetailResponse): string | null {
  if (Number(data.status) !== 200 || !data.feature?.attrs) {
    return null;
  }
  const title = 'Земельный участок';
  return buildTableHtml(title, data.feature.attrs);
}

function buildTableHtml(title: string, attrs: Record<string, string | number | null | undefined>): string {
  const rows = pickRows(attrs as Record<string, string | number | null | undefined>);
  const body = rows
    .map(
      ([k, v]) =>
        `<tr><th scope="row">${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`,
    )
    .join('');
  return `
    <div class="moinoviichistiimir-cadastre-card">
      <div class="moinoviichistiimir-cadastre-card__title">${escapeHtml(title)}</div>
      <table class="moinoviichistiimir-cadastre-table">${body}</table>
    </div>
  `;
}
