// Build src/data/countries.json from the `world-countries` dataset (ISO 3166 data
// derived from Natural Earth / mledoze). Keyed by ISO alpha-3 (cca3).
//
// The map uses `world-atlas` (Natural Earth 1:50m admin-0, medium resolution) whose
// TopoJSON features are keyed by ISO 3166-1 *numeric* codes. We store `id` (numeric)
// on every record so the runtime can join map shapes to country metadata.
//
// Run: node scripts/build-countries.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Load world-countries data
const raw = JSON.parse(
  readFileSync(resolve(root, 'node_modules/world-countries/countries.json'), 'utf8')
);

// Widely-quizzed states that world-countries marks non-independent but which
// have their own ISO code, capital, and map shape.
const INCLUDE_NON_INDEPENDENT = new Set(['PSE']); // Palestine

// Only quiz over independent (or allow-listed), mappable countries.
const countries = {};
let skipped = 0;

for (const c of raw) {
  const cca3 = c.cca3;
  const numeric = c.ccn3; // ISO numeric, matches world-atlas feature id
  const name = c.name?.common;
  const capital = Array.isArray(c.capital) ? c.capital[0] : c.capital;

  // Require the essentials to be a useful quiz target.
  if (!cca3 || !numeric || !name) {
    skipped++;
    continue;
  }
  // Skip non-sovereign / uninhabited edge cases that pollute the quiz.
  if (c.independent !== true && !INCLUDE_NON_INDEPENDENT.has(cca3)) {
    skipped++;
    continue;
  }

  countries[cca3] = {
    cca3,
    cca2: c.cca2, // ISO alpha-2, used as the flag code (flagcdn expects lowercase)
    id: numeric, // zero-padded 3-digit ISO numeric ("004","840") — matches world-atlas ids
    name,
    official: c.name?.official ?? name,
    capital: capital ?? null,
    region: c.region || 'Other', // continent-ish: Africa, Americas, Asia, Europe, Oceania
    subregion: c.subregion || c.region || 'Other',
    latlng: c.latlng || null,
    flag: (c.cca2 || '').toLowerCase(),
  };
}

const outDir = resolve(root, 'src/data');
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, 'countries.json');
writeFileSync(outFile, JSON.stringify(countries, null, 0) + '\n');

const list = Object.values(countries);
const byRegion = {};
for (const c of list) byRegion[c.region] = (byRegion[c.region] || 0) + 1;
const withCapital = list.filter((c) => c.capital).length;

console.log(`Wrote ${list.length} countries to ${outFile}`);
console.log(`  skipped (non-independent / missing fields): ${skipped}`);
console.log(`  with capital: ${withCapital}`);
console.log('  by region:', byRegion);
