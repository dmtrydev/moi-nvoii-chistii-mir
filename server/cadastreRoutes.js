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

function apiRequestBinary(targetUrl, { timeoutMs = UPSTREAM_TIMEOUT_MS, _redirects = 0, referer } = {}) {
  return new Promise((resolve, reject) => {
    const u = new NodeURL(targetUrl);
    const isHttps = u.protocol === 'https:';
    const transport = isHttps ? https : http;
    const defaultPort = isHttps ? 443 : 80;
    const effectiveReferer = referer ?? 'https://pkk.rosreestr.ru/';
    const effectiveOrigin = new NodeURL(effectiveReferer).origin;
    const req = transport.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        port: u.port || defaultPort,
        method: 'GET',
        rejectUnauthorized: false,
        headers: {
          Accept: 'image/png,image/*,*/*',
          Referer: effectiveReferer,
          Origin: effectiveOrigin,
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
          resolve(apiRequestBinary(nextUrl, { timeoutMs, _redirects: _redirects + 1, referer }));
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

const TILE_ZOOM_MAX = 21;

/** Convert XYZ tile to EPSG:3857 bbox string for WMS requests. */
function tileToBbox3857(z, x, y) {
  const n = Math.pow(2, z);
  const tileSize = (20037508.34 * 2) / n;
  const xmin = x * tileSize - 20037508.34;
  const xmax = (x + 1) * tileSize - 20037508.34;
  const ymax = 20037508.34 - y * tileSize;
  const ymin = 20037508.34 - (y + 1) * tileSize;
  return `${xmin},${ymin},${xmax},${ymax}`;
}

/**
 * Try tile sources in priority order.
 * 1. NSPD WMS (nspd.gov.ru) — official Rosreestr portal, WGS84/3857
 * 2. PKK ArcGIS tile (pkk.rosreestr.gov.ru) — might be blocked from VDS
 * 3. roscadastres.com raster — works for some areas/zooms
 * Returns { statusCode, contentType, body } or throws.
 */
async function fetchCadastreTile(z, x, y) {
  const bbox = tileToBbox3857(z, x, y);

  // Source 1: NSPD WMS (nspd.gov.ru)
  const nspdWmsUrl =
    `https://nspd.gov.ru/map/api/map/wms` +
    `?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
    `&LAYERS=zu&FORMAT=image%2Fpng&TRANSPARENT=true` +
    `&WIDTH=256&HEIGHT=256&SRS=EPSG%3A3857&STYLES=` +
    `&BBOX=${encodeURIComponent(bbox)}`;
  try {
    const r = await apiRequestBinary(nspdWmsUrl, { referer: 'https://nspd.gov.ru/', timeoutMs: 10_000 });
    if (r.statusCode === 200 && r.body.length > 100) return r;
  } catch { /* try next */ }

  // Source 2: PKK ArcGIS tile (ArcGIS format: tile/{z}/{row}/{col} = tile/{z}/{y}/{x})
  const pkkUrl =
    `https://pkk.rosreestr.gov.ru/arcgis/rest/services/PKK6/CadastreObjects/MapServer/tile/${z}/${y}/${x}`;
  try {
    const r = await apiRequestBinary(pkkUrl, { referer: 'https://pkk.rosreestr.ru/', timeoutMs: 8_000 });
    if (r.statusCode === 200 && r.body.length > 100) return r;
  } catch { /* try next */ }

  // Source 3: roscadastres.com raster tiles
  const rosUrl = `https://api.roscadastres.com/tiles/raster/${z}/${x}/${y}.png`;
  try {
    const r = await apiRequestBinary(rosUrl, { referer: 'https://ik2map.roscadastres.com/', timeoutMs: 8_000 });
    if (r.statusCode === 200 && r.body.length > 100) return r;
  } catch { /* all failed */ }

  return null;
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
  try {
    const result = await fetchCadastreTile(z, x, y);
    if (!result) return res.status(204).end();
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.end(result.body);
  } catch {
    return res.status(502).end();
  }
});

/** Diagnostic endpoint: test all tile sources for a Moscow tile at z=14. */
router.get('/test-sources', async (_req, res) => {
  const z = 14; const x = 9900; const y = 5044; // Moscow area z=14
  const bbox = tileToBbox3857(z, x, y);
  const results = {};

  const test = async (name, url, opts = {}) => {
    try {
      const r = await apiRequestBinary(url, { timeoutMs: 10_000, ...opts });
      results[name] = { status: r.statusCode, size: r.body.length, ct: r.contentType };
    } catch (e) {
      results[name] = { error: String(e?.message ?? e) };
    }
  };

  await test('nspd_wms',
    `https://nspd.gov.ru/map/api/map/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=zu&FORMAT=image%2Fpng&TRANSPARENT=true&WIDTH=256&HEIGHT=256&SRS=EPSG%3A3857&STYLES=&BBOX=${encodeURIComponent(bbox)}`,
    { referer: 'https://nspd.gov.ru/' });

  await test('pkk_tile',
    `https://pkk.rosreestr.gov.ru/arcgis/rest/services/PKK6/CadastreObjects/MapServer/tile/${z}/${y}/${x}`,
    { referer: 'https://pkk.rosreestr.ru/' });

  await test('roscadastres_z14',
    `https://api.roscadastres.com/tiles/raster/${z}/${x}/${y}.png`,
    { referer: 'https://ik2map.roscadastres.com/' });

  await test('roscadastres_z12',
    `https://api.roscadastres.com/tiles/raster/12/2476/1294.png`,
    { referer: 'https://ik2map.roscadastres.com/' });

  res.json({ tile: { z, x, y }, bbox, results });
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
