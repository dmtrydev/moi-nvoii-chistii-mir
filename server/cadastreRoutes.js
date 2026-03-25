/**
 * Прокси к публичным сервисам НСПД (ex-ПКК): identify по точке, карточка по к/н, GeoJSON ЗУ в bbox.
 * Базовый хост: CADASTRE_PKK_API_BASE (по умолчанию https://nspd.gov.ru).
 * Старый pkk.rosreestr.ru отдаёт редирект/HTML; JSON API /api/features там часто недоступен — используем WMS + geoportal.
 */
import { Router } from 'express';
import https from 'node:https';
import { URL as NodeURL } from 'node:url';

const router = Router();

const PKK_API_BASE = String(process.env.CADASTRE_PKK_API_BASE ?? '').trim() || 'https://nspd.gov.ru';
/** ArcGIS MapServer (если ещё доступен); для bbox по умолчанию используется intersects НСПД. */
const MAPSERVER_BASE = String(process.env.CADASTRE_MAPSERVER_BASE ?? '').trim();
const PARCEL_LAYER_ID = String(process.env.CADASTRE_PARCEL_LAYER_ID ?? '').trim() || '21';

const CAD_NUM_RE = /^\d+:\d+:\d+:\d+/;

/** typeId фронта (как в старом ПКК) → WMS layerId и categoryId для intersects (pynspd / НСПД). */
const TYPE_MAP = {
  1: { wmsLayerId: 36048, categoryId: 36368 },
  5: { wmsLayerId: 36049, categoryId: 36369 },
};

const TILE_SIZE = 512;
const WMS_ZOOM = 24;
const UPSTREAM_TIMEOUT_MS = (() => {
  const raw = process.env.CADASTRE_UPSTREAM_TIMEOUT_MS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : 15_000;
})();

function pkkReferer() {
  const fromEnv = String(process.env.CADASTRE_PKK_REFERER ?? '').trim();
  if (fromEnv) return fromEnv;
  const base = PKK_API_BASE.replace(/\/$/, '');
  return `${base}/map?thematic=PKK`;
}

function relaxTlsForHost(hostname) {
  return (
    hostname === 'pkk.rosreestr.ru' ||
    hostname === 'nspd.gov.ru' ||
    String(process.env.CADASTRE_TLS_INSECURE ?? '').trim() === '1'
  );
}

function pkkHeaders(accept) {
  return {
    Accept: accept,
    Referer: pkkReferer(),
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Origin: new URL(PKK_API_BASE).origin,
  };
}

function pkkRequest(targetUrl, { method = 'GET', accept = 'application/json, */*', body = null } = {}) {
  return new Promise((resolve, reject) => {
    const u = new NodeURL(targetUrl);
    const headers = { ...pkkHeaders(accept) };
    if (body != null) {
      headers['Content-Type'] = 'application/json; charset=utf-8';
      headers['Content-Length'] = String(Buffer.byteLength(body));
    }
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        port: u.port || 443,
        method,
        headers,
        rejectUnauthorized: !relaxTlsForHost(u.hostname),
      },
      (upstream) => {
        const chunks = [];
        upstream.on('data', (c) => chunks.push(c));
        upstream.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({
            statusCode: upstream.statusCode ?? 502,
            headers: upstream.headers,
            body: buf,
          });
        });
      },
    );

    // Render иногда возвращает 502, если внешние сервисы подвисают.
    // Таймаут гарантирует корректный fallback вместо “Bad Gateway”.
    req.setTimeout(UPSTREAM_TIMEOUT_MS, () => {
      req.destroy(new Error(`upstream timeout (${UPSTREAM_TIMEOUT_MS}ms)`));
    });
    req.on('error', reject);
    if (body != null) req.write(body);
    req.end();
  });
}

function isProbablyHtml(buf) {
  const s = buf.slice(0, 64).toString('utf8').trimStart().toLowerCase();
  return s.startsWith('<!') || s.startsWith('<html');
}

function mercatorTile(lng, lat, z) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x, y, z };
}

function tileBounds(tileX, tileY, z) {
  const n = 2 ** z;
  const west = (tileX / n) * 360 - 180;
  const east = ((tileX + 1) / n) * 360 - 180;
  const north = Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / n))) * (180 / Math.PI);
  const south = Math.atan(Math.sinh(Math.PI * (1 - (2 * (tileY + 1)) / n))) * (180 / Math.PI);
  return { west, south, east, north };
}

/** Как в pynspd: пиксель I,J для WMS 1.3.0 GetFeatureInfo. */
function wmsPixelFromLngLat(lng, lat) {
  const t = mercatorTile(lng, lat, WMS_ZOOM);
  const b = tileBounds(t.x, t.y, t.z);
  const i = ((lng - b.west) / (b.east - b.west)) * TILE_SIZE;
  const j = ((lat - b.south) / (b.north - b.south)) * TILE_SIZE;
  return { i: Math.floor(i), j: TILE_SIZE - Math.floor(j) };
}

function nspdPropsToAttrs(f) {
  const props = f.properties || {};
  const opt = props.options || {};
  const id = f.id != null ? String(f.id) : '';
  const cn = opt.cad_num ?? props.descr ?? props.externalKey ?? props.label ?? '';
  /** @type {Record<string, string | number | null | undefined>} */
  const attrs = {
    id,
    cn,
    cad_num: opt.cad_num,
    address: opt.readable_address,
    statecd: opt.status ?? opt.previously_posted,
    category: opt.land_record_category_type,
    category_type: opt.land_record_category_type,
    area_value: opt.land_record_area ?? opt.specified_area ?? opt.declared_area ?? opt.area,
    cad_cost: opt.cost_value,
    util_by_doc: opt.permitted_use_established_by_document,
    fp: opt.ownership_type ?? opt.right_type,
  };
  for (const k of Object.keys(attrs)) {
    if (attrs[k] == null || attrs[k] === '') delete attrs[k];
  }
  return attrs;
}

/** Ответ в формате, который ждёт фронт (buildCadastrePopupHtmlFromIdentify). */
function wrapIdentifyFromGeoJson(fc) {
  const features = (fc.features || []).slice(0, 20).map((f) => ({
    id: f.id != null ? String(f.id) : undefined,
    attrs: nspdPropsToAttrs(f),
  }));
  return { status: 200, features };
}

function xy3857ToLngLat(x, y) {
  const lng = (x / 20037508.34) * 180;
  const lat = (Math.atan(Math.sinh((y * Math.PI) / 20037508.34)) * 180) / Math.PI;
  return [lng, lat];
}

function mapCoords3857To4326(coords) {
  if (typeof coords[0] === 'number') {
    return xy3857ToLngLat(coords[0], coords[1]);
  }
  return coords.map(mapCoords3857To4326);
}

/** Первое кольцо полигона в Web Mercator даёт координаты по модулю >> 180. */
function ringLooksLike3857(ring) {
  if (!Array.isArray(ring) || ring.length === 0) return false;
  const [x, y] = ring[0];
  return typeof x === 'number' && typeof y === 'number' && (Math.abs(x) > 180 || Math.abs(y) > 90);
}

function geoJson3857To4326(geom) {
  if (!geom || !geom.coordinates) return geom;
  const name = geom.crs?.properties?.name;
  const is3857 =
    name === 'EPSG:3857' ||
    (geom.type === 'Polygon' && ringLooksLike3857(geom.coordinates[0])) ||
    (geom.type === 'MultiPolygon' && ringLooksLike3857(geom.coordinates[0]?.[0]));
  if (!is3857) return geom;
  const out = { ...geom, coordinates: mapCoords3857To4326(geom.coordinates) };
  delete out.crs;
  return out;
}

function normalizeParcelsCollection(fc) {
  const features = (fc.features || []).map((f) => {
    const g = f.geometry ? geoJson3857To4326({ ...f.geometry }) : f.geometry;
    return { ...f, geometry: g };
  });
  return { type: 'FeatureCollection', features };
}

async function identifyFallbackByIntersects(lat, lng, categoryId, limit) {
  const dLat = 0.00012;
  const dLng = 0.00018;
  const payload = {
    categories: [{ id: categoryId }],
    geom: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [lng - dLng, lat - dLat],
                [lng + dLng, lat - dLat],
                [lng + dLng, lat + dLat],
                [lng - dLng, lat + dLat],
                [lng - dLng, lat - dLat],
              ],
            ],
            crs: { type: 'name', properties: { name: 'EPSG:4326' } },
          },
        },
      ],
    },
  };
  const targetUrl = `${PKK_API_BASE.replace(/\/$/, '')}/api/geoportal/v1/intersects?typeIntersect=fullObject`;
  const upstream = await pkkRequest(targetUrl, {
    method: 'POST',
    accept: 'application/json, */*',
    body: JSON.stringify(payload),
  });
  if (upstream.statusCode >= 400 || isProbablyHtml(upstream.body)) return null;
  let fc;
  try {
    fc = JSON.parse(upstream.body.toString('utf8'));
  } catch {
    return null;
  }
  if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features)) return null;
  const wrapped = wrapIdentifyFromGeoJson(fc);
  if (!Array.isArray(wrapped.features) || wrapped.features.length === 0) return null;
  wrapped.features = wrapped.features.slice(0, limit);
  return wrapped;
}

/**
 * GET /api/cadastre/identify?lat=&lng=&tolerance=&typeId=1
 * НСПД: WMS GetFeatureInfo /api/aeggis/v3/{layerId}/wms
 */
router.get('/identify', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const typeId = String(req.query.typeId ?? '1');
  const limit = Math.min(20, Math.max(1, Number(req.query.limit ?? 8)));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ message: 'Укажите числовые lat и lng' });
  }

  const meta = TYPE_MAP[typeId] ?? TYPE_MAP[1];
  const layerId = meta.wmsLayerId;
  const categoryId = meta.categoryId;
  const { i, j } = wmsPixelFromLngLat(lng, lat);
  const t = mercatorTile(lng, lat, WMS_ZOOM);
  const b = tileBounds(t.x, t.y, t.z);
  const bbox = `${b.west},${b.south},${b.east},${b.north}`;

  const qs = new URLSearchParams({
    REQUEST: 'GetFeatureInfo',
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    INFO_FORMAT: 'application/json',
    FORMAT: 'image/png',
    STYLES: '',
    TRANSPARENT: 'true',
    QUERY_LAYERS: String(layerId),
    LAYERS: String(layerId),
    WIDTH: String(TILE_SIZE),
    HEIGHT: String(TILE_SIZE),
    I: String(i),
    J: String(j),
    CRS: 'EPSG:4326',
    BBOX: bbox,
    FEATURE_COUNT: String(limit),
  });

  const targetUrl = `${PKK_API_BASE.replace(/\/$/, '')}/api/aeggis/v3/${layerId}/wms?${qs.toString()}`;

  try {
    const upstream = await pkkRequest(targetUrl, { accept: 'application/json, */*' });
    if (upstream.statusCode >= 400 || isProbablyHtml(upstream.body)) {
      const fallback = await identifyFallbackByIntersects(lat, lng, categoryId, limit);
      if (fallback) {
        res.setHeader('X-Cadastre-Warning', 'identify-fallback-intersects');
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.json(fallback);
      }
      return res.status(502).json({
        message:
          'Сервис НСПД вернул не JSON. Проверьте CADASTRE_PKK_API_BASE (обычно https://nspd.gov.ru) и доступ с сервера.',
        statusCode: upstream.statusCode,
      });
    }
    let fc;
    try {
      fc = JSON.parse(upstream.body.toString('utf8'));
    } catch {
      return res.status(502).json({ message: 'Некорректный JSON от НСПД' });
    }
    if (fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
      return res.status(502).json({ message: 'Неожиданный ответ WMS (ожидался FeatureCollection)' });
    }
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.json(wrapIdentifyFromGeoJson(fc));
  } catch {
    return res.status(502).json({ message: 'Запрос к НСПД не выполнен' });
  }
});

/**
 * GET /api/cadastre/feature/:typeId/:featureId
 * Поиск карточки по кадастровому номеру через geoportal (не по внутреннему id объекта).
 */
router.get('/feature/:typeId/:featureId', async (req, res) => {
  const { typeId, featureId } = req.params;
  if (!typeId || !featureId) {
    return res.status(400).json({ message: 'Нужны typeId и featureId' });
  }
  if (!CAD_NUM_RE.test(decodeURIComponent(featureId))) {
    return res.status(400).json({
      message: 'Ожидается кадастровый номер вида 77:01:0001001:1484',
    });
  }

  const meta = TYPE_MAP[typeId] ?? TYPE_MAP[1];
  const layersId = meta.wmsLayerId;
  const qs = new URLSearchParams({
    query: decodeURIComponent(featureId),
    layersId: String(layersId),
  });
  const targetUrl = `${PKK_API_BASE.replace(/\/$/, '')}/api/geoportal/v2/search/geoportal?${qs.toString()}`;

  try {
    const upstream = await pkkRequest(targetUrl, { accept: 'application/json, */*' });
    const raw = upstream.body.toString('utf8');
    if (upstream.statusCode >= 400 || isProbablyHtml(upstream.body)) {
      return res.status(502).json({
        message: 'Поиск объекта на НСПД недоступен',
        statusCode: upstream.statusCode,
      });
    }
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      return res.status(502).json({ message: 'Некорректный JSON от НСПД' });
    }
    const feats = json?.data?.features;
    if (!Array.isArray(feats) || feats.length === 0) {
      return res.status(404).json({ message: 'Объект не найден' });
    }
    const attrs = nspdPropsToAttrs(feats[0]);
    res.setHeader('Cache-Control', 'public, max-age=120');
    return res.json({ status: 200, feature: { attrs } });
  } catch {
    return res.status(502).json({ message: 'Запрос к НСПД не выполнен' });
  }
});

function lonLatTo3857(lon, lat) {
  const x = (lon * 20037508.34) / 180;
  let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * 20037508.34) / 180;
  return { x, y };
}

/**
 * GET /api/cadastre/parcels?minLon&minLat&maxLon&maxLat&zoom=
 * GeoJSON ЗУ в bbox: POST /api/geoportal/v1/intersects (если задан CADASTRE_MAPSERVER_BASE — пробуем ArcGIS query).
 */
router.get('/parcels', async (req, res) => {
  const minLon = Number(req.query.minLon);
  const minLat = Number(req.query.minLat);
  const maxLon = Number(req.query.maxLon);
  const maxLat = Number(req.query.maxLat);
  const zoom = Number(req.query.zoom ?? 0);
  if (![minLon, minLat, maxLon, maxLat].every((n) => Number.isFinite(n))) {
    return res.status(400).json({ message: 'Нужны minLon, minLat, maxLon, maxLat' });
  }
  if (zoom < 14) {
    return res.json({ type: 'FeatureCollection', features: [] });
  }

  const categoryId = TYPE_MAP[1].categoryId;

  if (MAPSERVER_BASE) {
    const sw = lonLatTo3857(minLon, minLat);
    const ne = lonLatTo3857(maxLon, maxLat);
    const xmin = Math.min(sw.x, ne.x);
    const ymin = Math.min(sw.y, ne.y);
    const xmax = Math.max(sw.x, ne.x);
    const ymax = Math.max(sw.y, ne.y);
    const geometry = {
      xmin,
      ymin,
      xmax,
      ymax,
      spatialReference: { wkid: 102100 },
    };
    const qs = new URLSearchParams({
      f: 'geojson',
      where: '1=1',
      geometry: JSON.stringify(geometry),
      geometryType: 'esriGeometryEnvelope',
      inSR: '102100',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
    });
    const targetUrl = `${MAPSERVER_BASE.replace(/\/$/, '')}/${PARCEL_LAYER_ID}/query?${qs.toString()}`;
    try {
      const upstream = await pkkRequest(targetUrl, { accept: 'application/geo+json, application/json, */*' });
      const raw = upstream.body.toString('utf8');
      if (upstream.statusCode < 400 && !isProbablyHtml(upstream.body)) {
        try {
          const json = JSON.parse(raw);
          if (json.type === 'FeatureCollection' || Array.isArray(json.features)) {
            res.setHeader('Cache-Control', 'public, max-age=300');
            return res.json(json);
          }
        } catch {
          /* fall through to intersects */
        }
      }
    } catch {
      /* fall through */
    }
  }

  const payload = {
    categories: [{ id: categoryId }],
    geom: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [minLon, minLat],
                [maxLon, minLat],
                [maxLon, maxLat],
                [minLon, maxLat],
                [minLon, minLat],
              ],
            ],
            crs: { type: 'name', properties: { name: 'EPSG:4326' } },
          },
        },
      ],
    },
  };

  try {
    const targetUrl = `${PKK_API_BASE.replace(/\/$/, '')}/api/geoportal/v1/intersects?typeIntersect=fullObject`;
    const upstream = await pkkRequest(targetUrl, {
      method: 'POST',
      accept: 'application/json, */*',
      body: JSON.stringify(payload),
    });
    const raw = upstream.body.toString('utf8');
    if (upstream.statusCode >= 400 || isProbablyHtml(upstream.body)) {
      res.setHeader('X-Cadastre-Warning', 'intersects-unavailable');
      return res.json({ type: 'FeatureCollection', features: [] });
    }
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      res.setHeader('X-Cadastre-Warning', 'invalid-json');
      return res.json({ type: 'FeatureCollection', features: [] });
    }
    const fc = json.type === 'FeatureCollection' ? json : { type: 'FeatureCollection', features: [] };
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json(normalizeParcelsCollection(fc));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Не раскрываем полный текст наружу (может содержать URL/детали TLS),
    // но даём короткий кусок для понимания причины.
    const short = msg.length > 90 ? `${msg.slice(0, 90)}…` : msg;
    console.error('cadastre parcels network error:', err);
    res.setHeader('X-Cadastre-Warning', `network-error:${short}`);
    return res.json({ type: 'FeatureCollection', features: [] });
  }
});

export default router;
