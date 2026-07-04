// Country flag by ISO alpha-2 code, served from the free flagcdn.com CDN.
export default function Flag({ code, size = 'w320', alt = '', className = '' }) {
  if (!code) return null;
  const c = code.toLowerCase();
  return (
    <img
      className={`flag ${className}`}
      src={`https://flagcdn.com/${size}/${c}.png`}
      srcSet={`https://flagcdn.com/${size}/${c}.png 1x, https://flagcdn.com/${bump(size)}/${c}.png 2x`}
      alt={alt || `Flag of ${code.toUpperCase()}`}
      loading="lazy"
      width="320"
    />
  );
}

// pick a higher-res variant for 2x displays
function bump(size) {
  const map = { w160: 'w320', w320: 'w640', w640: 'w1280' };
  return map[size] || size;
}
