// Build src/data/water.json from Natural Earth marine polygons
// (ne_10m_geography_marine_polys) — oceans, seas, bays, gulfs, straits, etc.
// We keep just a label + a placement point (polygon centroid) + a class/rank
// so the map can reveal water names progressively as you zoom.
//
// Run: node scripts/build-water.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { geoCentroid } from 'd3-geo';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const SRC = '/tmp/marine.geojson';
const URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_geography_marine_polys.geojson';

let text;
if (existsSync(SRC)) text = readFileSync(SRC, 'utf8');
else {
  console.log('Downloading Natural Earth marine polygons…');
  text = await (await fetch(URL)).text();
}
const geo = JSON.parse(text);

const water = [];
for (const f of geo.features) {
  const p = f.properties;
  const name = p.label || p.name;
  if (!name) continue;
  const c = geoCentroid(f); // spherical centroid, robust across the antimeridian
  if (!c || Number.isNaN(c[0])) continue;
  water.push({
    name,
    lat: Math.round(c[1] * 1000) / 1000,
    lng: Math.round(c[0] * 1000) / 1000,
    cla: p.featurecla, // ocean | sea | bay | gulf | sound | strait | channel | ...
    rank: p.scalerank ?? 5,
    minLabel: p.min_label ?? 4,
  });
}
water.sort((a, b) => a.rank - b.rank);

const outFile = resolve(root, 'src/data/water.json');
writeFileSync(outFile, JSON.stringify(water) + '\n');

const byCla = {};
for (const w of water) byCla[w.cla] = (byCla[w.cla] || 0) + 1;
console.log(`Wrote ${water.length} water labels to ${outFile}`);
console.log('  by class:', byCla);
console.log('  size:', (JSON.stringify(water).length / 1024).toFixed(0), 'KB');
