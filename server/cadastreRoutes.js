import { Router } from 'express';
import http from 'node:http';
import https from 'node:https';
import { URL as NodeURL } from 'node:url';
import crypto from 'node:crypto';

const router = Router();
const API_BASE = 'https://api.roscadastres.com/pkk_files';
const UPSTREAM_TIMEOUT_MS = 15_000;

function apiRequest(targetUrl, { timeoutMs = UPSTREAM_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const u = new NodeURL(targetUrl);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        port: u.port || 443,
        method: 'GET',
        headers: {
          Accept: 'application/json, text/plain, */*',
          Referer: 'https://ik10map.roscadastres.com/map.html?v=91',
          Origin: 'https://ik10map.roscadastres.com',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
      },
      (upstream) => {
        const chunks = [];
        upstream.on('data', (c) => chunks.push(c));
        upstream.on('end', () => {
          resolve({
            statusCode: upstream.statusCode ?? 502,
            headers: upstream.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`upstream timeout ${timeoutMs}ms`)));
    req.on('error', reject);
    req.end();
  });
}

function apiRequestBinary(targetUrl, { timeoutMs = UPSTREAM_TIMEOUT_MS, _redirects = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new NodeURL(targetUrl);
    const isHttps = u.protocol === 'https:';
    const transport = isHttps ? https : http;
    const defaultPort = isHttps ? 443 : 80;
    const req = transport.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        port: u.port || defaultPort,
        method: 'GET',
        rejectUnauthorized: false,
        headers: {
          Accept: 'image/png,image/*,*/*',
          Referer: 'http://pkk5.rosreestr.ru/',
          Origin: 'http://pkk5.rosreestr.ru',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
      },
      (upstream) => {
        const statusCode = upstream.statusCode ?? 502;
        const location = upstream.headers['location'];
        // Follow redirects (301/302/307/308) up to 5 hops
        if ([301, 302, 307, 308].includes(statusCode) && location && _redirects < 5) {
          upstream.resume(); // drain response body
          const nextUrl = location.startsWith('http') ? location : new NodeURL(location, targetUrl).href;
          resolve(apiRequestBinary(nextUrl, { timeoutMs, _redirects: _redirects + 1 }));
          return;
        }
        const chunks = [];
        upstream.on('data', (c) => chunks.push(c));
        upstream.on('end', () => {
          resolve({
            statusCode,
            contentType: upstream.headers['content-type'] ?? 'image/png',
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`upstream timeout ${timeoutMs}ms`)));
    req.on('error', reject);
    req.end();
  });
}

function xy3857ToLngLat(x, y) {
  const lng = (x / 20037508.34) * 180;
  const lat = (Math.atan(Math.sinh((y * Math.PI) / 20037508.34)) * 180) / Math.PI;
  return [lng, lat];
}

function mapCoords3857To4326(coords) {
  if (!Array.isArray(coords) || coords.length === 0) return coords;
  if (typeof coords[0] === 'number') {
    return xy3857ToLngLat(coords[0], coords[1]);
  }
  return coords.map(mapCoords3857To4326);
}

function ringLooksLike3857(ring) {
  if (!Array.isArray(ring) || ring.length === 0) return false;
  const [x, y] = ring[0];
  return typeof x === 'number' && typeof y === 'number' && (Math.abs(x) > 180 || Math.abs(y) > 90);
}

function normalizeGeoJson4326(fc) {
  const features = (fc.features || []).map((f) => {
    const g = f.geometry ? { ...f.geometry } : null;
    if (g?.type === 'Polygon' && ringLooksLike3857(g.coordinates?.[0])) {
      g.coordinates = mapCoords3857To4326(g.coordinates);
    }
    if (g?.type === 'MultiPolygon' && ringLooksLike3857(g.coordinates?.[0]?.[0])) {
      g.coordinates = mapCoords3857To4326(g.coordinates);
    }
    if (g?.crs) delete g.crs;
    return { ...f, geometry: g };
  });
  return { type: 'FeatureCollection', features };
}

function extentToGeoJson(extent) {
  if (!extent || typeof extent !== 'object') return null;
  const xmin = Number(extent.xmin);
  const xmax = Number(extent.xmax);
  const ymin = Number(extent.ymin);
  const ymax = Number(extent.ymax);
  if (![xmin, xmax, ymin, ymax].every((n) => Number.isFinite(n))) return null;
  const sw = xy3857ToLngLat(xmin, ymin);
  const se = xy3857ToLngLat(xmax, ymin);
  const ne = xy3857ToLngLat(xmax, ymax);
  const nw = xy3857ToLngLat(xmin, ymax);
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[sw, se, ne, nw, sw]],
        },
      },
    ],
  };
}

function lonLatTo3857(lon, lat) {
  const x = (lon * 20037508.34) / 180;
  let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * 20037508.34) / 180;
  return { x, y };
}

function parseJsonSafe(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function first32Sha256HexInt(s) {
  const hex = crypto.createHash('sha256').update(s).digest('hex');
  return Number.parseInt(hex.slice(0, 8), 16);
}

async function requestToken({ query, action }) {
  const qs = new URLSearchParams({
    query: String(query),
    action: String(action),
    _: String(Date.now()),
  });
  const upstream = await apiRequest(`${API_BASE}/token.php?${qs.toString()}`);
  const json = parseJsonSafe(upstream.body);
  if (!json || json.error) {
    throw new Error('token endpoint returned invalid payload');
  }
  return json;
}

async function solvePow({ query, token }) {
  const threshold = Number(token.threshold);
  const timestamp = String(token.timestamp ?? '');
  if (!Number.isFinite(threshold) || !timestamp) {
    throw new Error('invalid token threshold/timestamp');
  }
  const started = Date.now();
  let nonce = 0;
  // Ограничиваем цикл, чтобы не зависнуть навсегда при проблемном токене.
  while (nonce < 25_000_000) {
    const value = first32Sha256HexInt(`${timestamp}${query}${nonce}`);
    if (value < threshold) {
      return { nonce, elapsed: Date.now() - started };
    }
    nonce += 1;
  }
  throw new Error('pow limit reached');
}

async function requestData({ query, type, token, pow }) {
  const qs = new URLSearchParams({
    query: String(query),
    action: 'data',
    type: String(type),
    timestamp: String(token.timestamp),
    hash: String(token.hash),
    threshold: String(token.threshold),
    version: String(token.version),
    nonce: String(pow.nonce),
    elapsed: String(pow.elapsed),
    _: String(Date.now()),
  });
  const upstream = await apiRequest(`${API_BASE}/data3.php?${qs.toString()}`);
  const json = parseJsonSafe(upstream.body);
  if (!json || json.error) {
    throw new Error('data endpoint returned invalid payload');
  }
  return json;
}

async function resolveDataResult(payload) {
  const func1 = payload?.func1;
  const func2 = payload?.func2;
  const data = payload?.data;
  if (typeof func1 !== 'string') {
    return null;
  }
  // Совместимость с внешним форматом API: он отдаёт JS-функции для декодирования данных.
  const stage1 = Function(`return (${func1})`)();
  const generatedCode = await Promise.resolve(stage1(func2));
  if (typeof generatedCode !== 'string') return null;
  const stage2 = Function(`return (${generatedCode})`)();
  return stage2(data);
}

function pickAttrsFromResolvedData(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const attrs = { ...raw };
  // Нормализуем ключи под фронтовый popup.
  if (!attrs.cad_num && attrs.cn) attrs.cad_num = attrs.cn;
  if (!attrs.cn && attrs.cad_num) attrs.cn = attrs.cad_num;
  if (!attrs.area_value && attrs.area) attrs.area_value = attrs.area;
  if (!attrs.cad_cost && attrs.cost_value) attrs.cad_cost = attrs.cost_value;
  if (!attrs.fp && attrs.right_type) attrs.fp = attrs.right_type;
  return attrs;
}

async function identifyByPoint({ lat, lng, typeId }) {
  const merc = lonLatTo3857(lng, lat);
  const qs = new URLSearchParams({
    t: String(typeId),
    lat: lat.toFixed(6),
    lng: lng.toFixed(6),
    lat_merc: merc.x.toFixed(6),
    lng_merc: merc.y.toFixed(6),
  });
  const upstream = await apiRequest(`${API_BASE}/coordinates2.php?${qs.toString()}`);
  const json = parseJsonSafe(upstream.body);
  if (!json || !Array.isArray(json.features) || json.features.length === 0) return null;
  const f = json.features[0];
  const attrs = f?.attrs && typeof f.attrs === 'object' ? { ...f.attrs } : {};
  return {
    id: String(attrs.id ?? ''),
    cn: String(attrs.cn ?? ''),
    attrs,
    extent: f?.extent ?? null,
  };
}

async function loadGeoByCadNumber(cn) {
  const qs = new URLSearchParams({ cn: String(cn), _: String(Date.now()) });
  const upstream = await apiRequest(`${API_BASE}/geo2.php?${qs.toString()}`);
  const json = parseJsonSafe(upstream.body);
  if (!json || json.type !== 'FeatureCollection' || !Array.isArray(json.features)) return null;
  return normalizeGeoJson4326(json);
}

const TILE_ZOOM_MAX = 20;
// PKK5 — HTTP (без SSL), общий слой кадастра для тайловой подложки
const PKK_EXPORT_BASE =
  'http://pkk5.rosreestr.ru/arcgis/rest/services/Cadastre/Cadastre/MapServer/export';

/**
 * Convert Leaflet tile coordinates (z, x, y) to a Web Mercator bounding box
 * string "xmin,ymin,xmax,ymax" suitable for ArcGIS MapServer export.
 */
function tileToBboxString(z, x, y) {
  const size = 20037508.342789244;
  const res = (2 * size) / Math.pow(2, z);
  const xmin = -size + x * res;
  const xmax = xmin + res;
  const ymax = size - y * res;
  const ymin = ymax - res;
  return `${xmin},${ymin},${xmax},${ymax}`;
}

router.get('/tiles/:z/:x/:y', async (req, res) => {
  const z = Number(req.params.z);
  const x = Number(req.params.x);
  const y = Number(req.params.y);
  if (
    !Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) ||
    z < 0 || z > TILE_ZOOM_MAX || x < 0 || y < 0
  ) {
    return res.status(400).end();
  }
  const bbox = tileToBboxString(z, x, y);
  const qs = new URLSearchParams({
    layers: 'show:21',
    dpi: '96',
    format: 'PNG32',
    bboxSR: '102100',
    imageSR: '102100',
    size: '256,256',
    transparent: 'true',
    f: 'image',
    bbox,
  });
  const tileUrl = `${PKK_EXPORT_BASE}?${qs.toString()}`;
  try {
    const result = await apiRequestBinary(tileUrl);
    if (result.statusCode === 404 || result.statusCode === 204) {
      return res.status(204).end();
    }
    if (result.statusCode >= 400) {
      return res.status(502).end();
    }
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.end(result.body);
  } catch {
    return res.status(502).end();
  }
});

router.get('/identify', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const requestedType = Number(req.query.typeId);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ message: 'Укажите числовые lat и lng' });
  }

  const typesToTry = Number.isFinite(requestedType) ? [requestedType] : [1, 5];
  try {
    let found = null;
    let usedType = typesToTry[0];
    for (const t of typesToTry) {
      const x = await identifyByPoint({ lat, lng, typeId: t });
      if (x) {
        found = x;
        usedType = t;
        break;
      }
    }
    if (!found) {
      return res.json({ status: 200, features: [] });
    }

    let detailedAttrs = {};
    if (found.id) {
      try {
        const token = await requestToken({ query: found.id, action: 'data' });
        const pow = await solvePow({ query: found.id, token });
        const dataPayload = await requestData({ query: found.id, type: usedType, token, pow });
        const resolved = await resolveDataResult(dataPayload);
        detailedAttrs = pickAttrsFromResolvedData(resolved);
      } catch {
        detailedAttrs = {};
      }
    }

    const attrs = { ...detailedAttrs, ...found.attrs };
    if (!attrs.cn && found.cn) attrs.cn = found.cn;
    if (!attrs.cad_num && attrs.cn) attrs.cad_num = attrs.cn;

    let geojson = null;
    if (attrs.cn) {
      try {
        geojson = await loadGeoByCadNumber(attrs.cn);
      } catch {
        geojson = null;
      }
    }
    if (!geojson) {
      geojson = extentToGeoJson(found.extent);
    }

    return res.json({
      status: 200,
      features: [{ id: found.id || undefined, attrs }],
      geojson,
    });
  } catch (err) {
    return res.status(502).json({
      message: err instanceof Error ? err.message : 'Запрос к кадастровому сервису не выполнен',
    });
  }
});

router.get('/health', async (_req, res) => {
  const lat = 55.751244;
  const lng = 37.618423;
  try {
    const identify = await identifyByPoint({ lat, lng, typeId: 1 });
    return res.json({
      ok: Boolean(identify),
      provider: 'api.roscadastres.com',
      checks: [
        {
          name: 'coordinates-identify',
          ok: Boolean(identify),
          sampleCn: identify?.cn ?? null,
        },
      ],
    });
  } catch (err) {
    return res.status(503).json({
      ok: false,
      provider: 'api.roscadastres.com',
      checks: [
        {
          name: 'coordinates-identify',
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        },
      ],
    });
  }
});

export default router;
