// localStorage persistence: per-country attempt/miss counts, plus best streak.
// Miss counts are used to weight question selection toward frequently-missed
// countries so the quiz adapts to the player.

const KEY = 'geolearner.stats.v1';

/** @typedef {{ seen:number, missed:number }} CountryStat */

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full / unavailable — ignore, quiz still works in-memory */
  }
}

/** Full stats object: { countries: {cca3: CountryStat}, bestStreak } */
export function getStats() {
  const s = load();
  return {
    countries: s.countries || {},
    bestStreak: s.bestStreak || 0,
    totalAnswered: s.totalAnswered || 0,
    totalCorrect: s.totalCorrect || 0,
  };
}

/** Record the result of a question for a given country. */
export function recordResult(cca3, correct) {
  const s = getStats();
  const c = s.countries[cca3] || { seen: 0, missed: 0 };
  c.seen += 1;
  if (!correct) c.missed += 1;
  s.countries[cca3] = c;
  s.totalAnswered += 1;
  if (correct) s.totalCorrect += 1;
  save(s);
  return s;
}

/** Update the best streak if the current run beat it. */
export function recordStreak(streak) {
  const s = getStats();
  if (streak > s.bestStreak) {
    s.bestStreak = streak;
    save(s);
  }
  return s.bestStreak;
}

/** Miss count for a country (0 if never missed). */
export function missCount(cca3) {
  return getStats().countries[cca3]?.missed || 0;
}

/** Clear all saved stats. */
export function resetStats() {
  save({});
}

/**
 * Weighted-random pick from `pool` that favors frequently-missed countries.
 * Each country starts with weight 1 and gains `missWeight` per recorded miss.
 * @param {{cca3:string}[]} pool
 * @param {number} missWeight
 */
export function weightedPick(pool, missWeight = 3) {
  const stats = getStats().countries;
  let total = 0;
  const weights = pool.map((c) => {
    const w = 1 + (stats[c.cca3]?.missed || 0) * missWeight;
    total += w;
    return w;
  });
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
