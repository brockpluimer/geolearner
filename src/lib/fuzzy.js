// Fuzzy answer matching for typed (hard) mode: tolerates typos, punctuation,
// diacritics, and common aliases / short names.

/** Common alternate names → canonical cca3. Lowercased keys. */
const ALIASES = {
  usa: 'USA',
  us: 'USA',
  'u.s.a.': 'USA',
  'u.s.': 'USA',
  america: 'USA',
  'united states of america': 'USA',
  uk: 'GBR',
  'u.k.': 'GBR',
  britain: 'GBR',
  'great britain': 'GBR',
  england: 'GBR',
  uae: 'ARE',
  'united arab emirates': 'ARE',
  drc: 'COD',
  'dr congo': 'COD',
  'democratic republic of the congo': 'COD',
  congo: 'COG',
  'republic of the congo': 'COG',
  'south korea': 'KOR',
  'north korea': 'PRK',
  'czech republic': 'CZE',
  czechia: 'CZE',
  russia: 'RUS',
  'russian federation': 'RUS',
  swaziland: 'SWZ',
  eswatini: 'SWZ',
  burma: 'MMR',
  myanmar: 'MMR',
  'cape verde': 'CPV',
  'ivory coast': 'CIV',
  "cote d'ivoire": 'CIV',
  'east timor': 'TLS',
  'timor leste': 'TLS',
  vatican: 'VAT',
  'vatican city': 'VAT',
  'holy see': 'VAT',
  'the gambia': 'GMB',
  gambia: 'GMB',
  'the bahamas': 'BHS',
  bahamas: 'BHS',
  'the netherlands': 'NLD',
  holland: 'NLD',
  macedonia: 'MKD',
  'north macedonia': 'MKD',
  laos: 'LAO',
  syria: 'SYR',
  brunei: 'BRN',
  bolivia: 'BOL',
  moldova: 'MDA',
  tanzania: 'TZA',
  vietnam: 'VNM',
  'viet nam': 'VNM',
};

/** Normalize a string: lowercase, strip diacritics, drop non-alphanumerics. */
export function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining diacritics
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Pre-normalize alias keys so lookups are punctuation/diacritic-insensitive.
const NORM_ALIASES = Object.fromEntries(
  Object.entries(ALIASES).map(([k, v]) => [normalize(k).replace(/\s+/g, ' '), v])
);

/** Levenshtein edit distance (iterative, O(mn) space-optimized). */
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Does the typed guess match the target country's name?
 * Accepts exact/normalized matches, known aliases, and near-misses (typos)
 * scaled to the answer length.
 * @param {string} guess
 * @param {{cca3:string, name:string, official?:string}} country
 */
export function matchesCountry(guess, country) {
  const g = normalize(guess);
  if (!g) return false;

  // Alias table (matched on the normalized guess).
  if (NORM_ALIASES[g] === country.cca3) return true;

  // Compare against the common and official names.
  const targets = [country.name, country.official].filter(Boolean).map(normalize);
  for (const t of targets) {
    if (g === t) return true;
    // Allow more slack for longer names: ~1 edit per 6 chars, min 1, max 3.
    const tolerance = Math.min(3, Math.max(1, Math.floor(t.length / 6)));
    if (levenshtein(g, t) <= tolerance) return true;
    // Also accept dropping a leading article ("the gambia" -> "gambia").
    const tNoArticle = t.replace(/^the /, '');
    if (g === tNoArticle) return true;
  }
  return false;
}

/** Resolve free text to a cca3 via alias table (used for hints/debug). */
export function aliasToCca3(text) {
  return NORM_ALIASES[normalize(text)] || null;
}
