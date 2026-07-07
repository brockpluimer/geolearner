// Interactive SVG world map (d3-geo) with Google-Maps-style pan/zoom.
//
// - Pan by dragging, zoom with the wheel / pinch / on-screen controls.
// - Level of detail: a coarse 1:110m outline when zoomed out, swapping to the
//   detailed 1:50m coastlines once you zoom in.
// - A city layer (Natural Earth populated places) fades in as you zoom —
//   capitals first, then smaller cities — with constant-size ink markers.
// - `focusCca3` smoothly frames a country so it fills ~60% of the viewport,
//   keeping its neighbours in view for context.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoNaturalEarth1, geoPath, geoCentroid, geoBounds } from 'd3-geo';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import 'd3-transition';
import { mapFeatures50, mapFeatures110, byCca3 } from '../lib/countries.js';
import cityData from '../data/cities.json';
import waterData from '../data/water.json';

const W = 900;
const H = 470;
const MIN_K = 1;
const MAX_K = 96; // allow very deep manual zoom
const FOCUS_MAX_K = 16; // cap for auto-framing so the "stock" view stays at ~60%
const DETAIL_THRESHOLD = 2.4; // zoom scale at which we swap to 1:50m detail

// One shared projection so both detail levels and the city layer line up.
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

// Pre-project cities into base map coords, with the zoom level at which each
// dot / label should appear (capitals reveal earlier than ordinary cities).
const CITIES = cityData
  .map((c) => {
    const pt = projection([c.lng, c.lat]);
    if (!pt) return null;
    const dotMinK = c.cap ? 1.5 + c.rank * 0.15 : 2.2 + c.rank * 0.55;
    return {
      name: c.name,
      cap: c.cap === 1,
      rank: c.rank,
      x: pt[0],
      y: pt[1],
      dotMinK,
      labelMinK: c.cap ? dotMinK + 0.5 : dotMinK + 1.6,
    };
  })
  .filter(Boolean);

// Pre-project water labels (oceans / seas / bays / gulfs / straits). Oceans show
// at the world view; seas and smaller waters reveal as you zoom in.
const WATER = waterData
  .map((w) => {
    const pt = projection([w.lng, w.lat]);
    if (!pt) return null;
    const tier = w.cla === 'ocean' ? 'ocean' : w.cla === 'sea' ? 'sea' : 'minor';
    const minK = tier === 'ocean' ? 1 : tier === 'sea' ? 2.2 + w.rank * 0.12 : 3.5 + w.rank * 0.15;
    return { name: w.name, x: pt[0], y: pt[1], tier, minK };
  })
  .filter(Boolean);

// Precompute an auto-frame transform per country. We pick the country's main
// landmass (largest polygon by *spherical* extent, so an antimeridian-crossing
// bbox can't masquerade as huge) and size the zoom from its angular extent using
// the projection's local pixels-per-degree — robust for Russia, Fiji, USA→48, etc.
function angularSize(featureLike) {
  const [[w, s], [e, n]] = geoBounds(featureLike);
  const degW = e < w ? e + 360 - w : e - w; // handle antimeridian wrap
  return [Math.max(degW, 0.02), Math.max(n - s, 0.02)];
}
function focusFor(feature) {
  const g = feature.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  // Pick the main landmass by vertex count — robust to antimeridian wraps that
  // can inflate a polygon's apparent bounding-box area.
  let best = null;
  let bestPts = -1;
  for (const poly of polys) {
    const pts = poly[0].length;
    if (pts > bestPts) {
      bestPts = pts;
      best = { type: 'Feature', geometry: { type: 'Polygon', coordinates: poly } };
    }
  }
  if (!best) return null;
  const [dw, dh] = angularSize(best);
  const c = geoCentroid(best);
  const [cx, cy] = projection(c);
  // local scale of the projection at the centroid
  const px = projection([c[0] + 0.5, c[1]]);
  const py = projection([c[0], c[1] + 0.5]);
  const pxPerLon = Math.max(Math.abs(px[0] - cx) / 0.5, 0.01);
  const pxPerLat = Math.max(Math.abs(py[1] - cy) / 0.5, 0.01);
  const projW = dw * pxPerLon;
  const projH = dh * pxPerLat;
  const k = Math.max(MIN_K, Math.min(FOCUS_MAX_K, 0.6 * Math.min(W / projW, H / projH)));
  return { k, tx: W / 2 - k * cx, ty: H / 2 - k * cy, area: bestPts, cx, cy };
}
const FOCUS = {};
const FOCUS_AREA = {};
for (const f of mapFeatures50) {
  const r = focusFor(f);
  if (!r) continue;
  if (r.area > (FOCUS_AREA[f.country.cca3] ?? -1)) {
    FOCUS_AREA[f.country.cca3] = r.area;
    FOCUS[f.country.cca3] = r;
  }
}

// Country name labels, anchored at each country's main-landmass centroid. Placed
// by the live transform (constant screen size) and culled to the viewport, so a
// framed country's neighbours are named without cluttering the whole world.
const COUNTRY_LABELS = Object.entries(FOCUS).map(([cca3, r]) => ({
  cca3,
  name: byCca3[cca3]?.name ?? cca3,
  x: r.cx,
  y: r.cy,
  area: r.area,
}));

export default function WorldMap({
  highlightCca3 = null,
  revealCca3 = null,
  wrongCca3 = null,
  interactive = false,
  focusCca3 = null,
  showCountryLabels = false,
  onCountryClick,
  onCountryHover,
}) {
  const svgRef = useRef(null);
  const zoomRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [t, setT] = useState({ k: 1, x: 0, y: 0 });

  const detail = t.k >= DETAIL_THRESHOLD ? 'hi' : 'lo';
  const paths = PATHS[detail];
  const hoveredCca3 = hovered?.cca3 ?? null;
  // Labels sit outside the zoom transform (constant ink weight), so on their own
  // they'd stay the same tiny size no matter how far you zoom in. Grow them with
  // zoom — gently, and capped — so a zoomed-in region is actually readable.
  const labelScale = Math.min(2.1, Math.max(1, Math.pow(t.k, 0.38)));

  // Set up the zoom behavior once. All transform changes flow through here.
  useEffect(() => {
    const svg = select(svgRef.current);
    const zb = d3zoom()
      .scaleExtent([MIN_K, MAX_K])
      .translateExtent([
        [0, 0],
        [W, H],
      ])
      .on('zoom', (event) => {
        const { k, x, y } = event.transform;
        setT({ k, x, y });
      });
    svg.call(zb);
    svg.on('dblclick.zoom', null);
    zoomRef.current = zb;
    return () => svg.on('.zoom', null);
  }, []);

  // Auto-frame the focus country so it fills ~60% of the viewport.
  useEffect(() => {
    const svg = select(svgRef.current);
    const zb = zoomRef.current;
    if (!zb) return;
    const f = FOCUS[focusCca3];
    if (!focusCca3 || !f) {
      svg.transition().duration(650).call(zb.transform, zoomIdentity);
      return;
    }
    const tf = zoomIdentity.translate(f.tx, f.ty).scale(f.k);
    svg.transition().duration(750).call(zb.transform, tf);
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

  // Country paths only depend on the data/hover state, not the transform, so
  // they aren't rebuilt while panning or zooming.
  const pathEls = useMemo(
    () =>
      paths.map((p) => {
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
      }),
    [paths, highlightCca3, revealCca3, wrongCca3, hoveredCca3, interactive, handleEnter, handleLeave, onCountryClick]
  );

  // Water labels: italic names positioned by the current transform, revealed by
  // zoom (oceans always, then seas, then bays/gulfs/straits).
  const waterLayer = useMemo(() => {
    const pad = 70;
    const out = [];
    for (const w of WATER) {
      if (t.k < w.minK) continue;
      const sx = w.x * t.k + t.x;
      const sy = w.y * t.k + t.y;
      if (sx < -pad || sx > W + pad || sy < -pad || sy > H + pad) continue;
      out.push({ ...w, sx, sy });
      if (out.length >= 40) break;
    }
    return out.map((w, i) => (
      <text
        key={`${w.name}-${i}`}
        className={`water-label water-label--${w.tier}`}
        x={w.sx.toFixed(1)}
        y={w.sy.toFixed(1)}
      >
        {w.name}
      </text>
    ));
  }, [t]);

  // City layer: constant-size markers positioned by the current transform, LOD
  // by zoom, and culled to the viewport so it stays light at deep zoom.
  const cityLayer = useMemo(() => {
    if (t.k < 1.5) return null;
    const pad = 44;
    let dots = [];
    for (const c of CITIES) {
      if (t.k < c.dotMinK) continue;
      const sx = c.x * t.k + t.x;
      const sy = c.y * t.k + t.y;
      if (sx < -pad || sx > W + pad || sy < -pad || sy > H + pad) continue;
      dots.push({ ...c, sx, sy });
    }
    dots.sort((a, b) => b.cap - a.cap || a.rank - b.rank);
    if (dots.length > 450) dots = dots.slice(0, 450);
    let labelBudget = 60;
    return dots.map((c, i) => {
      const showLabel = t.k >= c.labelMinK && labelBudget > 0;
      if (showLabel) labelBudget--;
      return (
        <g key={`${c.name}-${i}`} transform={`translate(${c.sx.toFixed(1)} ${c.sy.toFixed(1)})`}>
          {c.cap ? (
            <>
              <circle className="city-cap-ring" r="3.2" />
              <circle className="city-cap-dot" r="1.2" />
            </>
          ) : (
            <circle className="city-dot" r="2" />
          )}
          {showLabel && (
            <text className={`city-label${c.cap ? ' city-label--cap' : ''}`} x={c.cap ? 6 : 5} y="3.2">
              {c.name}
            </text>
          )}
        </g>
      );
    });
  }, [t]);

  // Country name labels for orientation. We skip the country being guessed
  // (highlightCca3) so surroundings are named without giving the answer away.
  const countryLabelLayer = useMemo(() => {
    if (!showCountryLabels) return null;
    const pad = 8;
    let labels = [];
    for (const l of COUNTRY_LABELS) {
      if (l.cca3 === highlightCca3) continue;
      const sx = l.x * t.k + t.x;
      const sy = l.y * t.k + t.y;
      if (sx < pad || sx > W - pad || sy < pad || sy > H - pad) continue;
      labels.push({ ...l, sx, sy });
    }
    labels.sort((a, b) => b.area - a.area);
    if (labels.length > 28) labels = labels.slice(0, 28);
    return labels.map((l) => (
      <text
        key={l.cca3}
        className="country-label"
        x={l.sx.toFixed(1)}
        y={l.sy.toFixed(1)}
      >
        {l.name}
      </text>
    ));
  }, [t, showCountryLabels, highlightCca3]);

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
        style={{ '--label-scale': labelScale.toFixed(3) }}
      >
        <g transform={`translate(${t.x} ${t.y}) scale(${t.k})`}>{pathEls}</g>
        <g className="water-layer">{waterLayer}</g>
        <g className="country-label-layer">{countryLabelLayer}</g>
        <g className="city-layer">{cityLayer}</g>
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
