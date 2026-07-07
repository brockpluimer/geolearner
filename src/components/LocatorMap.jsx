// A regional locator: the map zoomed to a country's neighbourhood, with that
// country filled dark so you can see the general area around it ("the one
// tucked between France and Spain…"). Used by the Heads Up "Location" deck.
//
// The world is projected once; each country just gets a translate/scale
// transform that frames its main landmass — robust, and no per-card reprojection
// (and none of d3-geo's hand-built-polygon winding gotchas).
import { useMemo } from 'react';
import { geoNaturalEarth1, geoPath, geoBounds, geoCentroid } from 'd3-geo';
import { mapFeatures110, featureByCca3 } from '../lib/countries.js';
import waterData from '../data/water.json';

const W = 440;
const H = 280;
const FILL = 0.4; // target country ≈ this fraction of the frame
const MIN_K = 1.1;
const MAX_K = 64;
// Below this on-screen size a target is too small to read as a shape, so we ring
// it with a constant-size marker that points to exactly where it sits.
const MARKER_BELOW = 46;
const MAX_COUNTRY_LABELS = 7;
const MAX_WATER_LABELS = 3;

const base = geoNaturalEarth1().fitExtent(
  [
    [0, 0],
    [W, H],
  ],
  { type: 'FeatureCollection', features: mapFeatures110 }
);
const basePath = geoPath(base);
const WORLD = mapFeatures110.map((f, i) => ({ key: `${f.country.cca3}__${i}`, d: basePath(f) }));
const feature110 = Object.fromEntries(mapFeatures110.map((f) => [f.country.cca3, f]));

// Pre-projected label anchors (in base coords). Per card we just push these
// through the framing transform and cull to what's on screen.
const COUNTRY_ANCHORS = mapFeatures110
  .map((f) => {
    const [bx, by] = base(geoCentroid(f));
    const [dw, dh] = angularSize(f);
    return { cca3: f.country.cca3, name: f.country.name, bx, by, area: dw * dh };
  })
  .filter((a) => Number.isFinite(a.bx) && Number.isFinite(a.by));
const WATER_ANCHORS = waterData
  .map((w) => {
    const p = base([w.lng, w.lat]);
    return p ? { name: w.name, bx: p[0], by: p[1], rank: w.rank } : null;
  })
  .filter(Boolean);

// The country's largest polygon — robust to far-flung territories (US→lower 48)
// and antimeridian wraps that would inflate a bounding box.
function mainland(feature) {
  const g = feature.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let best = polys[0];
  let bestPts = -1;
  for (const poly of polys) {
    if (poly[0].length > bestPts) {
      bestPts = poly[0].length;
      best = poly;
    }
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: best } };
}

function angularSize(feature) {
  const [[w, s], [e, n]] = geoBounds(feature);
  const dw = e < w ? e + 360 - w : e - w; // antimeridian wrap
  return [Math.max(dw, 0.03), Math.max(n - s, 0.03)];
}

export default function LocatorMap({ cca3, className = '' }) {
  const { transform, targetD, countryLabels, waterLabels, marker } = useMemo(() => {
    const feat = feature110[cca3] || featureByCca3[cca3];
    if (!feat) return { transform: '', targetD: null, countryLabels: [], waterLabels: [], marker: null };
    const land = mainland(feat);
    const [dw, dh] = angularSize(land);
    const c = geoCentroid(land);
    const [cx, cy] = base(c);
    // Local pixels-per-degree of the projection at the centroid.
    const px = base([c[0] + 0.5, c[1]]);
    const py = base([c[0], c[1] + 0.5]);
    const pxPerLon = Math.max(Math.abs(px[0] - cx) / 0.5, 0.01);
    const pxPerLat = Math.max(Math.abs(py[1] - cy) / 0.5, 0.01);
    const projW = dw * pxPerLon;
    const projH = dh * pxPerLat;
    const k = Math.max(MIN_K, Math.min(MAX_K, FILL * Math.min(W / projW, H / projH)));
    const tx = W / 2 - k * cx;
    const ty = H / 2 - k * cy;

    // Micro-states (San Marino, Monaco…) can't be zoomed enough to read as a
    // shape without losing all surrounding context, so past the zoom clamp they
    // stay a near-invisible speck. Ring them so it's clear where the card points.
    // The target centroid always lands dead-centre of the frame (W/2, H/2).
    const targetPx = Math.max(projW, projH) * k;
    const marker =
      targetPx < MARKER_BELOW ? { r: Math.max(13, targetPx / 2 + 9) } : null;

    // Project each anchor into screen space and keep the ones on-frame.
    const pad = 6;
    const onFrame = (a) => {
      const sx = k * a.bx + tx;
      const sy = k * a.by + ty;
      return sx > pad && sx < W - pad && sy > pad && sy < H - pad ? { ...a, sx, sy } : null;
    };
    const countries = COUNTRY_ANCHORS.filter((a) => a.cca3 !== cca3)
      .map(onFrame)
      .filter(Boolean)
      .sort((a, b) => b.area - a.area) // biggest neighbours first
      .slice(0, MAX_COUNTRY_LABELS);
    const waters = WATER_ANCHORS.map(onFrame)
      .filter(Boolean)
      .sort((a, b) => a.rank - b.rank) // most significant bodies first
      .slice(0, MAX_WATER_LABELS);

    return {
      transform: `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${k.toFixed(3)})`,
      targetD: basePath(feat),
      countryLabels: countries,
      waterLabels: waters,
      marker,
    };
  }, [cca3]);

  return (
    <svg className={`locator-map ${className}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Location on the map">
      <rect className="locator-ocean" x="0" y="0" width={W} height={H} />
      <g transform={transform}>
        <g className="locator-land">
          {WORLD.map((p) => (
            <path key={p.key} d={p.d} />
          ))}
        </g>
        {targetD && (
          <g className="locator-target">
            <path d={targetD} />
          </g>
        )}
      </g>
      {/* The marker and labels sit outside the scaled group so they stay a
          constant size regardless of how far the region is zoomed. */}
      {marker && (
        <g className="locator-marker" transform={`translate(${W / 2} ${H / 2})`}>
          <circle className="locator-marker-halo" r={(marker.r + 2).toFixed(1)} />
          <circle className="locator-marker-ring" r={marker.r.toFixed(1)} />
          <circle className="locator-marker-dot" r="2.6" />
        </g>
      )}
      <g className="locator-labels">
        {waterLabels.map((l, i) => (
          <text key={`w${i}`} className="locator-wlabel" x={l.sx.toFixed(1)} y={l.sy.toFixed(1)}>
            {l.name}
          </text>
        ))}
        {countryLabels.map((l) => (
          <text key={l.cca3} className="locator-clabel" x={l.sx.toFixed(1)} y={l.sy.toFixed(1)}>
            {l.name}
          </text>
        ))}
      </g>
    </svg>
  );
}
