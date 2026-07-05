// A regional locator: the map zoomed to a country's neighbourhood, with that
// country filled dark so you can see the general area around it ("the one
// tucked between France and Spain…"). Used by the Heads Up "Location" deck.
import { useMemo } from 'react';
import { geoNaturalEarth1, geoPath, geoBounds, geoCentroid } from 'd3-geo';
import { mapFeatures110, featureByCca3 } from '../lib/countries.js';

const W = 440;
const H = 280;
const PAD = 8;

const feature110 = Object.fromEntries(mapFeatures110.map((f) => [f.country.cca3, f]));

// The country's largest polygon — robust to far-flung territories (US→lower 48,
// France→mainland) and to antimeridian wraps that inflate a bounding box.
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

const clampLat = (v) => Math.max(-84, Math.min(84, v));

// Build a projection framed to the target's region: the country sits at roughly
// a third of the frame, with a clamped amount of surrounding context.
function frameProjection(feature) {
  const land = mainland(feature);
  const [[w, s], [e, n]] = geoBounds(land);
  let spanLon = e - w;
  if (spanLon < 0) spanLon += 360; // antimeridian wrap
  const span = Math.max(spanLon, n - s, 0.5);
  const half = Math.min(Math.max(span * 1.6, 9), 70); // degrees of context each side
  const [cx, cy] = geoCentroid(land);
  const box = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [cx - half, clampLat(cy - half)],
          [cx + half, clampLat(cy - half)],
          [cx + half, clampLat(cy + half)],
          [cx - half, clampLat(cy + half)],
          [cx - half, clampLat(cy - half)],
        ],
      ],
    },
  };
  return geoNaturalEarth1().fitExtent(
    [
      [PAD, PAD],
      [W - PAD, H - PAD],
    ],
    box
  );
}

export default function LocatorMap({ cca3, className = '' }) {
  const { world, target } = useMemo(() => {
    const feat = feature110[cca3] || featureByCca3[cca3];
    if (!feat) return { world: [], target: [] };
    const proj = frameProjection(feat);
    const path = geoPath(proj);
    return {
      world: mapFeatures110.map((f, i) => ({ key: `${f.country.cca3}__${i}`, d: path(f) })),
      // Highlight from the same feature we framed with, so it always draws even
      // when a small country is absent from the low-detail world backdrop.
      target: [{ key: 0, d: path(feat) }],
    };
  }, [cca3]);

  return (
    <svg
      className={`locator-map ${className}`}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Location on the map"
    >
      <rect className="locator-ocean" x="0" y="0" width={W} height={H} />
      <g className="locator-land">
        {world.map((p) => (
          <path key={p.key} d={p.d} />
        ))}
      </g>
      <g className="locator-target">
        {target.map((p) => (
          <path key={p.key} d={p.d} />
        ))}
      </g>
    </svg>
  );
}
