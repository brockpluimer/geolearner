// Interactive SVG world map rendered from the world-atlas TopoJSON via d3-geo.
// Handles hover (name/ISO readout), click (spatial answering + exploration),
// and coloring: highlight a target, reveal the correct shape, mark a wrong click.
import { useMemo, useState, useCallback } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { mapFeatures } from '../lib/countries.js';

const W = 900;
const H = 460;

// The projection and path strings never change, so build them once.
const projection = geoNaturalEarth1().fitSize([W, H], {
  type: 'FeatureCollection',
  features: mapFeatures,
});
const pathGen = geoPath(projection);
// A country can have more than one geometry at this resolution (e.g. separate
// landmasses sharing one ISO), so give each path a unique render key.
const PATHS = mapFeatures.map((f, i) => ({
  key: `${f.country.cca3}__${i}`,
  cca3: f.country.cca3,
  name: f.country.name,
  d: pathGen(f),
}));

export default function WorldMap({
  highlightCca3 = null,
  revealCca3 = null,
  wrongCca3 = null,
  interactive = false,
  onCountryClick,
  onCountryHover,
  dimUnhighlighted = false,
}) {
  const [hovered, setHovered] = useState(null);

  const byCca3 = useMemo(() => {
    const m = {};
    for (const p of PATHS) m[p.cca3] = p;
    return m;
  }, []);

  const handleEnter = useCallback(
    (p) => {
      setHovered(p);
      onCountryHover?.(p);
    },
    [onCountryHover]
  );
  const handleLeave = useCallback(() => {
    setHovered(null);
    onCountryHover?.(null);
  }, [onCountryHover]);

  const hoveredCca3 = hovered?.cca3 ?? null;

  return (
    <div className="worldmap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="worldmap-svg"
        role="img"
        aria-label="World map"
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x="0" y="0" width={W} height={H} fill="transparent" onMouseEnter={handleLeave} />
        <g>
          {PATHS.map((p) => {
            const state = classify(p.cca3, {
              highlightCca3,
              revealCca3,
              wrongCca3,
              hoveredCca3,
              interactive,
            });
            const dim =
              dimUnhighlighted && highlightCca3 && p.cca3 !== highlightCca3 && state === 'base';
            return (
              <path
                key={p.key}
                d={p.d}
                className={`country country--${state}${dim ? ' country--dim' : ''}`}
                onMouseEnter={() => handleEnter(p)}
                onMouseLeave={handleLeave}
                onClick={interactive ? () => onCountryClick?.(byCca3[p.cca3]) : undefined}
                style={{ cursor: interactive ? 'pointer' : 'default' }}
              />
            );
          })}
        </g>
      </svg>
      {(interactive || highlightCca3) && (
        <div className="worldmap-readout" aria-live="polite">
          {hovered ? (
            <>
              <span className="worldmap-readout-name">{hovered.name}</span>
              <span className="worldmap-readout-iso">{hovered.cca3}</span>
            </>
          ) : (
            <span className="worldmap-readout-hint">
              {interactive ? 'Hover a country • click to answer' : 'Hover to read country names'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function classify(cca3, { highlightCca3, revealCca3, wrongCca3, hoveredCca3, interactive }) {
  if (revealCca3 === cca3) return 'correct';
  if (wrongCca3 === cca3) return 'wrong';
  if (highlightCca3 === cca3) return 'highlight';
  if (interactive && hoveredCca3 === cca3) return 'hover';
  return 'base';
}
