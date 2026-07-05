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

const W = 440;
const H = 280;
const FILL = 0.4; // target country ≈ this fraction of the frame
const MIN_K = 1.1;
const MAX_K = 42;

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
  const { transform, targetD } = useMemo(() => {
    const feat = feature110[cca3] || featureByCca3[cca3];
    if (!feat) return { transform: '', targetD: null };
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
    return { transform: `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${k.toFixed(3)})`, targetD: basePath(feat) };
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
    </svg>
  );
}
