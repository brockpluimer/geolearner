// Start screen: choose a mode, region filter, and MC-vs-typed difficulty.
import { MODE_LIST } from '../lib/quiz.js';
import { regions } from '../lib/countries.js';
import { getStats, resetStats } from '../lib/storage.js';

export default function Menu({ region, setRegion, typed, setTyped, onStart }) {
  const stats = getStats();
  const missed = Object.entries(stats.countries)
    .filter(([, s]) => s.missed > 0)
    .sort((a, b) => b[1].missed - a[1].missed);

  return (
    <div className="menu">
      <header className="menu-hero">
        <h1 className="brand">
          geo<span>learner</span>
        </h1>
        <p className="tagline">Learn the world — one country at a time.</p>
      </header>

      <section className="menu-controls">
        <div className="field">
          <label className="field-label" htmlFor="region">
            Region
          </label>
          <select
            id="region"
            className="select"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="All">All regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="field-label">Difficulty</span>
          <div className="toggle" role="group" aria-label="Answer difficulty">
            <button
              className={`toggle-btn${!typed ? ' is-active' : ''}`}
              onClick={() => setTyped(false)}
            >
              Multiple choice
            </button>
            <button
              className={`toggle-btn${typed ? ' is-active' : ''}`}
              onClick={() => setTyped(true)}
            >
              Type it
            </button>
          </div>
        </div>
      </section>

      <section className="mode-grid">
        {MODE_LIST.map((m) => (
          <button key={m.id} className="mode-card" onClick={() => onStart(m.id)}>
            <span className="mode-card-icon" aria-hidden="true">
              {MODE_ICONS[m.id]}
            </span>
            <span className="mode-card-title">{m.label}</span>
            <span className="mode-card-blurb">{m.blurb}</span>
            {typed && !m.canType && <span className="mode-card-note">MC only</span>}
          </button>
        ))}
      </section>

      {stats.totalAnswered > 0 && (
        <section className="menu-stats">
          <p>
            Lifetime: <strong>{stats.totalCorrect}</strong> / {stats.totalAnswered} correct · best
            streak <strong>{stats.bestStreak}</strong>
          </p>
          {missed.length > 0 && (
            <p className="menu-missed">
              Trouble spots:{' '}
              {missed.slice(0, 6).map(([cca3], i) => (
                <span key={cca3} className="chip">
                  {cca3}
                </span>
              ))}
              {missed.length > 6 && ` +${missed.length - 6} more`}
            </p>
          )}
          <button
            className="link-btn"
            onClick={() => {
              if (confirm('Reset all saved progress and trouble-spot tracking?')) {
                resetStats();
                setRegion(region); // force re-render via state churn
                location.reload();
              }
            }}
          >
            Reset progress
          </button>
        </section>
      )}
    </div>
  );
}

const MODE_ICONS = {
  'map-name': 'I',
  'flag-name': 'II',
  'country-capital': 'III',
  'capital-country': 'IV',
  'find-map': 'V',
};
