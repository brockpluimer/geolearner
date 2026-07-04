// Interactive SVG world map (d3-geo) with Google-Maps-style pan/zoom.
//
// - Pan by dragging, zoom with the wheel / pinch / on-screen controls.
// - Level of detail: a coarse 1:110m outline when zoomed out, swapping to the
//   detailed 1:50m coastlines once you zoom in.
// - `focusCca3` smoothly frames a country so it fills ~60% of the viewport,
//   keeping its neighbours in view for context.
import { useCallback, useEffect, useRef, useState } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import 'd3-transition';
import { mapFeatures50, mapFeatures110, byCca3 } from '../lib/countries.js';

const W = 900;
const H = 470;
const MIN_K = 1;
const MAX_K = 14;
const DETAIL_THRESHOLD = 2.4; // zoom scale at which we swap to 1:50m detail

// One shared projection so both detail levels line up exactly.
const projection = geoNaturalEarth1().fitExtent(
  [
    [8, 8],
    [W - 8, H - 8],
  ],
  { type: 'FeatureCollection', features: mapFeatures50 }
);
const pathGen = geoPath(projection);

function buildPaths(features) {
  return features.map((f, i) => ({
    key: `${f.country.cca3}__${i}`,
    cca3: f.country.cca3,
    d: pathGen(f),
  }));
}
const PATHS = { hi: buildPaths(mapFeatures50), lo: buildPaths(mapFeatures110) };

// Projected bounding box per country (from the detailed set) for auto-framing.
const BOUNDS = {};
for (const f of mapFeatures50) {
  const b = pathGen.bounds(f);
  const prev = BOUNDS[f.country.cca3];
  BOUNDS[f.country.cca3] = prev
    ? [
        [Math.min(prev[0][0], b[0][0]), Math.min(prev[0][1], b[0][1])],
        [Math.max(prev[1][0], b[1][0]), Math.max(prev[1][1], b[1][1])],
      ]
    : b;
}

export default function WorldMap({
  highlightCca3 = null,
  revealCca3 = null,
  wrongCca3 = null,
  interactive = false,
  focusCca3 = null,
  onCountryClick,
  onCountryHover,
}) {
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const zoomRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [scale, setScale] = useState(1);

  const detail = scale >= DETAIL_THRESHOLD ? 'hi' : 'lo';
  const paths = PATHS[detail];

  // Set up the zoom behavior once.
  useEffect(() => {
    const svg = select(svgRef.current);
    const zb = d3zoom()
      .scaleExtent([MIN_K, MAX_K])
      .translateExtent([
        [0, 0],
        [W, H],
      ])
      .on('zoom', (event) => {
        const t = event.transform;
        if (gRef.current) gRef.current.setAttribute('transform', t.toString());
        setScale(t.k);
      });
    svg.call(zb);
    svg.on('dblclick.zoom', null); // dbl-click shouldn't fight the quiz
    zoomRef.current = zb;
    return () => svg.on('.zoom', null);
  }, []);

  // Auto-frame the focus country so it fills ~60% of the viewport.
  useEffect(() => {
    const svg = select(svgRef.current);
    const zb = zoomRef.current;
    if (!zb) return;
    if (!focusCca3 || !BOUNDS[focusCca3]) {
      svg.transition().duration(650).call(zb.transform, zoomIdentity);
      return;
    }
    const [[x0, y0], [x1, y1]] = BOUNDS[focusCca3];
    const dx = Math.max(x1 - x0, 4);
    const dy = Math.max(y1 - y0, 4);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const k = Math.max(MIN_K, Math.min(MAX_K, 0.6 * Math.min(W / dx, H / dy)));
    const t = zoomIdentity.translate(W / 2 - k * cx, H / 2 - k * cy).scale(k);
    svg.transition().duration(750).call(zb.transform, t);
  }, [focusCca3]);

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

  const zoomBy = (factor) => {
    const svg = select(svgRef.current);
    if (zoomRef.current) svg.transition().duration(250).call(zoomRef.current.scaleBy, factor);
  };
  const resetZoom = () => {
    const svg = select(svgRef.current);
    if (zoomRef.current) svg.transition().duration(500).call(zoomRef.current.transform, zoomIdentity);
  };

  const hoveredCca3 = hovered?.cca3 ?? null;
  const showReadout = interactive || highlightCca3 || focusCca3;

  return (
    <div className="worldmap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="worldmap-svg"
        role="img"
        aria-label="World map"
        preserveAspectRatio="xMidYMid meet"
      >
        <g ref={gRef}>
          {paths.map((p) => {
            const state = classify(p.cca3, {
              highlightCca3,
              revealCca3,
              wrongCca3,
              hoveredCca3,
              interactive,
            });
            return (
              <path
                key={p.key}
                d={p.d}
                className={`country country--${state}`}
                onMouseEnter={() => handleEnter(p)}
                onMouseLeave={handleLeave}
                onClick={interactive ? () => onCountryClick?.({ cca3: p.cca3 }) : undefined}
                style={{ cursor: interactive ? 'pointer' : 'grab' }}
              />
            );
          })}
        </g>
      </svg>

      <div className="worldmap-zoom">
        <button className="zoombtn" onClick={() => zoomBy(1.6)} aria-label="Zoom in" title="Zoom in">
          +
        </button>
        <button
          className="zoombtn"
          onClick={() => zoomBy(1 / 1.6)}
          aria-label="Zoom out"
          title="Zoom out"
        >
          −
        </button>
        <button className="zoombtn" onClick={resetZoom} aria-label="Reset view" title="Reset view">
          ⤢
        </button>
      </div>

      {showReadout && (
        <div className="worldmap-readout" aria-live="polite">
          {hovered ? (
            <>
              <span className="worldmap-readout-name">{countryName(hovered.cca3)}</span>
              <span className="worldmap-readout-iso">{hovered.cca3}</span>
            </>
          ) : (
            <span className="worldmap-readout-hint">
              {interactive ? 'Click a country · scroll to zoom' : 'Drag to pan · scroll to zoom'}
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

function countryName(cca3) {
  return byCca3[cca3]?.name ?? cca3;
}
