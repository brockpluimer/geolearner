// Build src/data/cities.json from Natural Earth populated places
// (ne_10m_populated_places_simple). Keeps national capitals plus the more
// prominent cities (by scalerank) so the map can reveal detail as you zoom.
//
// Run: node scripts/build-cities.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const SRC = '/tmp/ne_places.geojson';
const URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson';

let text;
if (existsSync(SRC)) {
  text = readFileSync(SRC, 'utf8');
} else {
  console.log('Downloading Natural Earth populated places…');
  const res = await fetch(URL);
  text = await res.text();
}
const geo = JSON.parse(text);

// scalerank: 0 = most prominent (megacity), 10 = tiny town.
// Keep national capitals (any rank) + cities with scalerank <= 6.
const MAX_RANK = 6;
const cities = [];
for (const f of geo.features) {
  const p = f.properties;
  const cap = p.adm0cap === 1;
  if (!cap && p.scalerank > MAX_RANK) continue;
  const [lng, lat] = f.geometry.coordinates;
  cities.push({
    name: p.name || p.nameascii,
    lat: Math.round(lat * 1000) / 1000,
    lng: Math.round(lng * 1000) / 1000,
    pop: p.pop_max || 0,
    rank: p.scalerank,
    cap: cap ? 1 : 0,
    iso: p.adm0_a3,
  });
}
// Capitals first, then by prominence — nicer for any "top N" slicing.
cities.sort((a, b) => b.cap - a.cap || a.rank - b.rank || b.pop - a.pop);

const outFile = resolve(root, 'src/data/cities.json');
writeFileSync(outFile, JSON.stringify(cities) + '\n');

const caps = cities.filter((c) => c.cap).length;
console.log(`Wrote ${cities.length} cities to ${outFile}`);
console.log(`  national capitals: ${caps}`);
console.log(`  size: ${(JSON.stringify(cities).length / 1024).toFixed(0)} KB`);
