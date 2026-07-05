// A small world locator: the whole map with one country filled dark and ringed,
// so the room can describe *where* it is ("small country in West Africa…").
// Used by the Heads Up "Location" deck. Static — no pan/zoom.
import { useMemo } from 'react';
import { geoNaturalEarth1, geoPath, geoCentroid } from 'd3-geo';
import { mapFeatures110, featureByCca3 } from '../lib/countries.js';

const W = 420;
const H = 250;

// One shared projection fitting the whole world into the box.
const projection = geoNaturalEarth1().fitExtent(
  [
    [6, 6],
    [W - 6, H - 6],
  ],
  { type: 'FeatureCollection', features: mapFeatures110 }
);
const pathGen = geoPath(projection);

// Pre-render the world outline once; highlight is layered on top per country.
const WORLD = mapFeatures110.map((f, i) => ({
  key: `${f.country.cca3}__${i}`,
  cca3: f.country.cca3,
  d: pathGen(f),
}));
const feature110 = Object.fromEntries(mapFeatures110.map((f) => [f.country.cca3, f]));

export default function LocatorMap({ cca3, className = '' }) {
  const target = useMemo(() => {
    const feat = feature110[cca3] || featureByCca3[cca3];
    const d = WORLD.filter((w) => w.cca3 === cca3).map((w) => w.d);
    const [cx, cy] = feat ? projection(geoCentroid(feat)) : [W / 2, H / 2];
    return { d, cx, cy };
  }, [cca3]);

  return (
    <svg className={`locator-map ${className}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Location on the world map">
      <g className="locator-land">
        {WORLD.map((w) => (
          <path key={w.key} d={w.d} />
        ))}
      </g>
      <g className="locator-target">
        {target.d.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      {/* Ring so even a tiny country is findable at a glance. */}
      <circle className="locator-ring" cx={target.cx.toFixed(1)} cy={target.cy.toFixed(1)} r="20" />
    </svg>
  );
}
