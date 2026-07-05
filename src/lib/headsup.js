// Heads Up party mode: deck definitions + queue building.
//
// A "deck" decides what the card shows (the answer the room describes); the
// round is a 60-second sprint scored by how many you get. Queues are just a
// shuffled pool of countries filtered to what each deck can render.
import { countries, mappableCountries, shuffle } from './countries.js';

/** Available Heads Up decks. `render` is consumed by the card component. */
export const HEADSUP_DECKS = {
  countries: {
    id: 'countries',
    label: 'Countries',
    blurb: 'Describe the country — no saying its name.',
    icon: '◍',
  },
  flags: {
    id: 'flags',
    label: 'Flags',
    blurb: 'Clue the flag — colors, symbols, stripes.',
    icon: '⚑',
  },
  shapes: {
    id: 'shapes',
    label: 'Location',
    blurb: 'Describe where it is on the map.',
    icon: '◈',
  },
  capitals: {
    id: 'capitals',
    label: 'Capitals',
    blurb: 'Clue the capital city.',
    icon: '★',
  },
};

export const DECK_LIST = Object.values(HEADSUP_DECKS);

/**
 * Build a shuffled card queue for a deck, filtered to a region.
 * @param {object} opts
 * @param {string} opts.deck    deck id
 * @param {string} [opts.region] region name or 'All'
 * @returns {import('./countries.js').Country[]}
 */
export function buildDeck({ deck, region = 'All' }) {
  let pool;
  switch (deck) {
    case 'shapes':
      pool = mappableCountries;
      break;
    case 'capitals':
      pool = countries.filter((c) => c.capital);
      break;
    case 'flags':
      pool = countries.filter((c) => c.cca2);
      break;
    default:
      pool = countries;
  }
  let filtered = region && region !== 'All' ? pool.filter((c) => c.region === region) : pool;
  // A tiny region would make for a repetitive round — fall back to the full pool.
  if (filtered.length < 6) filtered = pool;
  return shuffle(filtered);
}
