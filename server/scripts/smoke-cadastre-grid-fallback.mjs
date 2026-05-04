// Standalone smoke test for the /grid extent fallback. Hits the live upstream
// coordinates2.php (which works) and verifies extentToGeoJson produces a valid
// FeatureCollection ready for the client GeoJSON layer.
//
// Run from repo root: node server/scripts/smoke-cadastre-grid-fallback.mjs

import https from 'node:https';
import { URL as NodeURL } from 'node:url';

function get(targetUrl, headers = {}) {
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
          'User-Agent': 'Mozilla/5.0',
          ...headers,
        },
      },
      (resp) => {
        const chunks = [];
        resp.on('data', (c) => chunks.push(c));
        resp.on('end', () =>
          resolve({ status: resp.statusCode, body: Buffer.concat(chunks).toString('utf8') }),
        );
      },
    );
    req.setTimeout(15_000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

function xy3857ToLngLat(x, y) {
  const lng = (x / 20037508.34) * 180;
  const lat = (Math.atan(Math.sinh((y * Math.PI) / 20037508.34)) * 180) / Math.PI;
  return [lng, lat];
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
      { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[sw, se, ne, nw, sw]] } },
    ],
  };
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

// Krasnogorsk-area point that we know returns a parcel (verified during plan).
const lat = 55.8;
const lng = 37.4;
const x = (lng * 20037508.34) / 180;
const yRaw = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
const y = (yRaw * 20037508.34) / 180;

const url =
  `https://api.roscadastres.com/pkk_files/coordinates2.php?t=1` +
  `&lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}` +
  `&lat_merc=${x.toFixed(6)}&lng_merc=${y.toFixed(6)}`;

const r = await get(url, { Referer: 'https://ik10map.roscadastres.com/map.html?v=91' });
if (r.status !== 200) fail(`coordinates2.php HTTP ${r.status}`);

const json = JSON.parse(r.body);
const f = json?.features?.[0];
if (!f) fail('coordinates2.php returned no features');
if (!f.attrs?.cn) fail('feature has no cn');
if (!f.extent) fail('feature has no extent');

const fc = extentToGeoJson(f.extent);
if (!fc || fc.type !== 'FeatureCollection') fail('extentToGeoJson did not return a FeatureCollection');
if (!Array.isArray(fc.features) || fc.features.length !== 1) fail('expected exactly one feature');

const poly = fc.features[0];
if (poly.geometry?.type !== 'Polygon') fail('feature geometry is not a Polygon');
const ring = poly.geometry.coordinates?.[0];
if (!Array.isArray(ring) || ring.length !== 5) fail('polygon ring should have 5 points (closed quad)');
for (const [pLng, pLat] of ring) {
  if (!Number.isFinite(pLng) || !Number.isFinite(pLat)) fail('non-finite coord in ring');
  if (Math.abs(pLng) > 180 || Math.abs(pLat) > 90) fail(`coord out of range: ${pLng}, ${pLat}`);
}
if (ring[0][0] !== ring[4][0] || ring[0][1] !== ring[4][1]) fail('ring is not closed');

console.log('OK extent->polygon fallback works');
console.log(`  cn=${f.attrs.cn}  ring=${ring.length} pts`);
console.log(`  sw=[${ring[0].map((n) => n.toFixed(5)).join(', ')}]  ne=[${ring[2].map((n) => n.toFixed(5)).join(', ')}]`);
