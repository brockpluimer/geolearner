// Quiz engine: mode definitions + question generation.
//
// A "question" is a normalized object the UI can render regardless of mode:
//   { modeId, target, prompt:{kind,text,flag,highlightCca3}, answer:{kind,entity},
//     choices:[{id,label,correct,cca3}] }
//
// The MC engine draws 3 distractors from the target's region (see pickDistractors),
// shuffles, and marks the correct choice. A global "typed" toggle upgrades the
// country-answer MC modes into hard typed mode.
import { countries, mappableCountries, pickDistractors, shuffle, sample } from './countries.js';
import { weightedPick } from './storage.js';
import { matchesCountry, normalize } from './fuzzy.js';

/** Available quiz modes. `entity` is what the player must produce. */
export const MODES = {
  'map-name': {
    id: 'map-name',
    label: 'Map → Name',
    blurb: 'A country lights up — name it.',
    prompt: 'map',
    entity: 'country',
    needsShape: true,
    canType: true,
  },
  'flag-name': {
    id: 'flag-name',
    label: 'Flag → Country',
    blurb: 'See a flag, pick its country.',
    prompt: 'flag',
    entity: 'country',
    needsShape: false,
    canType: true,
  },
  'country-capital': {
    id: 'country-capital',
    label: 'Country → Capital',
    blurb: 'Name the capital city.',
    prompt: 'text',
    entity: 'capital',
    needsShape: false,
    canType: true,
  },
  'capital-country': {
    id: 'capital-country',
    label: 'Capital → Country',
    blurb: 'Which country has this capital?',
    prompt: 'text',
    entity: 'country',
    needsShape: false,
    canType: true,
  },
  'find-map': {
    id: 'find-map',
    label: 'Find on Map',
    blurb: 'Click the country on the world map.',
    prompt: 'text',
    entity: 'country',
    needsShape: true,
    canType: false, // answered by clicking the map
    spatial: true,
  },
};

export const MODE_LIST = Object.values(MODES);

/**
 * Build the candidate pool for a mode given a region filter.
 * @param {object} opts
 * @param {string} opts.modeId
 * @param {string} opts.region  region name or 'All'
 */
export function buildPool({ modeId, region }) {
  const mode = MODES[modeId];
  let pool = mode.needsShape ? mappableCountries : countries;
  if (region && region !== 'All') pool = pool.filter((c) => c.region === region);
  return pool;
}

let seq = 0;

/**
 * Generate the next question.
 * @param {object} opts
 * @param {string} opts.modeId
 * @param {string} [opts.region]  region filter ('All' by default)
 * @param {boolean} [opts.typed]  hard mode: typed answers where the mode allows
 * @param {string} [opts.avoidCca3] don't repeat this target back-to-back
 */
export function generateQuestion({ modeId, region = 'All', typed = false, avoidCca3 } = {}) {
  const mode = MODES[modeId];
  let pool = buildPool({ modeId, region });
  if (pool.length < 2) pool = mode.needsShape ? mappableCountries : countries;

  // Weighted toward frequently-missed countries; avoid immediate repeat.
  let candidates = pool.filter((c) => c.cca3 !== avoidCca3);
  if (candidates.length === 0) candidates = pool;
  const target = weightedPick(candidates);

  const useTyped = typed && mode.canType;
  const answerKind = mode.spatial ? 'map' : useTyped ? 'typed' : 'mc';

  const prompt = buildPrompt(mode, target);
  const q = {
    id: ++seq,
    modeId,
    mode,
    target,
    prompt,
    answer: { kind: answerKind, entity: mode.entity },
    choices: null,
  };

  if (answerKind === 'mc') {
    q.choices = buildChoices(mode, target, pool);
  }
  return q;
}

function buildPrompt(mode, target) {
  switch (mode.prompt) {
    case 'map':
      return { kind: 'map', highlightCca3: target.cca3, text: 'Which country is highlighted?' };
    case 'flag':
      return { kind: 'flag', flag: target.flag, cca2: target.cca2, text: 'Which country?' };
    case 'text':
    default:
      if (mode.entity === 'capital')
        return { kind: 'text', text: target.name, sub: 'What is its capital?' };
      // capital-country / find-map: show the capital or country name as the ask
      if (mode.id === 'capital-country')
        return { kind: 'text', text: target.capital, sub: 'is the capital of…' };
      return { kind: 'text', text: target.name, sub: 'Find it on the map' };
  }
}

function labelFor(mode, country) {
  return mode.entity === 'capital' ? country.capital : country.name;
}

function buildChoices(mode, target, pool) {
  // For capital answers, distractors must have distinct capitals.
  const distractors = pickDistractors(target, pool, 3);
  const options = shuffle([target, ...distractors]);
  return options.map((c, i) => ({
    id: `${c.cca3}-${i}`,
    label: labelFor(mode, c),
    cca3: c.cca3,
    correct: c.cca3 === target.cca3,
  }));
}

/**
 * Check a typed answer against the question's target.
 * @returns {boolean}
 */
export function checkTyped(question, text) {
  const { mode, target } = question;
  if (mode.entity === 'capital') {
    // Capitals: normalized equality (no alias table). Allow "the" drop.
    const g = normalize(text);
    const t = normalize(target.capital);
    return !!g && (g === t || g === t.replace(/^the /, ''));
  }
  return matchesCountry(text, target);
}

/** Sample a random mode id (used for a "surprise me" flow if desired). */
export function randomModeId() {
  return sample(MODE_LIST).id;
}
