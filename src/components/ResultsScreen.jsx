// End-of-session summary: accuracy, streak, and a review of missed countries.
import Flag from './Flag.jsx';

export default function ResultsScreen({ session, onPlayAgain, onMenu }) {
  const { answered, correct, bestRunStreak, history, modeLabel } = session;
  const pct = answered ? Math.round((correct / answered) * 100) : 0;
  const missed = history.filter((h) => !h.correct);
  const grade = gradeFor(pct);

  return (
    <div className="results">
      <div className="results-card">
        <p className="results-eyebrow">{modeLabel} · session complete</p>
        <div className={`results-grade grade--${grade.key}`}>{grade.emoji}</div>
        <h2 className="results-score">
          {correct}
          <span className="results-score-sep">/</span>
          {answered}
        </h2>
        <p className="results-pct">{pct}% correct</p>

        <div className="results-metrics">
          <Metric label="Best streak" value={bestRunStreak} />
          <Metric label="Missed" value={missed.length} />
          <Metric label="Grade" value={grade.label} />
        </div>

        {missed.length > 0 ? (
          <div className="results-review">
            <h3>Review your misses</h3>
            <ul className="review-list">
              {missed.map((h, i) => (
                <li key={`${h.cca3}-${i}`} className="review-item">
                  <Flag code={h.cca2} size="w80" className="flag--inline" />
                  <span className="review-name">{h.name}</span>
                  <span className="review-meta">
                    {h.capital} · {h.region}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          answered > 0 && <p className="results-perfect">Flawless run — not a single miss! 🌟</p>
        )}

        <div className="results-actions">
          <button className="btn btn--primary" onClick={onPlayAgain}>
            Play again
          </button>
          <button className="btn btn--ghost" onClick={onMenu}>
            Change mode
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

function gradeFor(pct) {
  if (pct >= 95) return { key: 'a', emoji: '🏆', label: 'Cartographer' };
  if (pct >= 80) return { key: 'b', emoji: '🌍', label: 'Globetrotter' };
  if (pct >= 60) return { key: 'c', emoji: '🧭', label: 'Explorer' };
  if (pct >= 40) return { key: 'd', emoji: '📖', label: 'Student' };
  return { key: 'e', emoji: '🌱', label: 'Rookie' };
}
