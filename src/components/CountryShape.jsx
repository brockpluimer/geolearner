// A single country's silhouette, fitted to fill its box. Used by the Heads Up
// "Map shapes" deck. Self-contained (its own projection per shape) so it stays
// independent of the big interactive WorldMap.
import { useMemo } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { featureByCca3 } from '../lib/countries.js';

const W = 320;
const H = 220;

export default function CountryShape({ cca3, className = '' }) {
  const d = useMemo(() => {
    const f = featureByCca3[cca3];
    if (!f) return null;
    const proj = geoNaturalEarth1().fitExtent(
      [
        [12, 12],
        [W - 12, H - 12],
      ],
      f
    );
    return geoPath(proj)(f);
  }, [cca3]);

  if (!d) return null;
  return (
    <svg className={`country-shape ${className}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Country outline">
      <path d={d} />
    </svg>
  );
}
