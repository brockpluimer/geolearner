// Country data-access layer.
// countries.json is keyed by ISO alpha-3 (cca3). Each record also carries the ISO
// numeric `id` used to join against the world-atlas TopoJSON map shapes.
import raw from '../data/countries.json';
import topo50 from '../data/world-50m.json';
import topo110 from '../data/world-110m.json';
import { feature } from 'topojson-client';

/** @typedef {{cca3:string,cca2:string,id:string,name:string,official:string,
 * capital:string|null,region:string,subregion:string,latlng:number[]|null,flag:string}} Country */

/** All countries as an array. */
export const countries = /** @type {Country[]} */ (Object.values(raw));

/** Lookup by ISO alpha-3. */
export const byCca3 = raw;

/** Lookup by ISO numeric id (the world-atlas feature id). */
export const byId = Object.fromEntries(countries.map((c) => [c.id, c]));

/** Lookup by ISO alpha-2. */
export const byCca2 = Object.fromEntries(
  countries.map((c) => [c.cca2.toUpperCase(), c])
);

/** Ordered list of regions/continents present in the data. */
export const regions = [...new Set(countries.map((c) => c.region))].sort();

// --- Map geometry -----------------------------------------------------------

// Decode each TopoJSON resolution into GeoJSON features. Only keep features that
// join to a country in our dataset so the map and quiz stay in sync.
function buildFeatures(topology) {
  return feature(topology, topology.objects.countries)
    .features.map((f) => ({ ...f, country: byId[String(f.id)] || null }))
    .filter((f) => f.country);
}

/** High-detail (1:50m) features — used when zoomed in. */
export const mapFeatures50 = buildFeatures(topo50);
/** Low-detail (1:110m) features — used for the zoomed-out overview. */
export const mapFeatures110 = buildFeatures(topo110);

/** Default feature set (high detail). */
export const mapFeatures = mapFeatures50;

/** Set of cca3 codes that have a renderable shape (for map/spatial modes). */
export const mappableCca3 = new Set(mapFeatures.map((f) => f.country.cca3));

/** Countries that have a shape on the map. */
export const mappableCountries = countries.filter((c) => mappableCca3.has(c.cca3));

// --- Selection helpers ------------------------------------------------------

export function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick `count` distractor countries for `target`, preferring the same region so
 * the quiz stays challenging. Falls back to any country if the region is small.
 * @param {Country} target
 * @param {Country[]} pool  candidate countries to draw from
 * @param {number} count
 */
export function pickDistractors(target, pool, count = 3) {
  const notTarget = pool.filter((c) => c.cca3 !== target.cca3);
  const sameRegion = shuffle(notTarget.filter((c) => c.region === target.region));
  const others = shuffle(notTarget.filter((c) => c.region !== target.region));
  return [...sameRegion, ...others].slice(0, count);
}
