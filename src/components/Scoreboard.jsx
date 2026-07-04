// Live score, current streak, and best streak.
export default function Scoreboard({ score, answered, streak, bestStreak }) {
  const pct = answered ? Math.round((score / answered) * 100) : 0;
  return (
    <div className="scoreboard">
      <Stat label="Score" value={`${score}/${answered}`} sub={answered ? `${pct}%` : '—'} />
      <Stat label="Streak" value={streak} highlight={streak >= 3} />
      <Stat label="Best" value={bestStreak} />
    </div>
  );
}

function Stat({ label, value, sub, highlight }) {
  return (
    <div className={`stat${highlight ? ' stat--hot' : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">
        {label}
        {sub != null && <span className="stat-sub"> {sub}</span>}
      </div>
    </div>
  );
}
