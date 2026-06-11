/**
 * Neutrale, on-brand placeholder voor posts zonder hero-afbeelding.
 *
 * De CMS-posts hebben (nog) geen heroImage. In plaats van een lege/kapotte kaart
 * tonen we een schone SASA-placeholder. Het is een inline SVG (data-URI), dus er
 * is geen extra netwerkrequest — goed voor PageSpeed.
 *
 * Zodra een post een echte heroImage in het CMS krijgt, wint die automatisch
 * (zie postImage() in cms.ts). Deze placeholder is puur een nette tussenstand.
 */

const BG = '#1A2E26'; // SASA donkergroen
const ACCENT = '#9fe870'; // SASA accentgroen

// Kleine deterministische hash van de slug, voor subtiele variatie per post.
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Bouwt een inline-SVG data-URI placeholder. width/height bepalen de aspect ratio. */
export function fallbackImage(slug: string, width = 1400, height = Math.round((width * 9) / 16)): string {
  const h = hash(slug || 'sasa');
  // Variatie: positie en grootte van de decoratieve cirkel verschillen per post.
  const cx = (0.55 + (h % 40) / 100) * width; // 0.55–0.95
  const cy = (0.1 + ((h >> 4) % 30) / 100) * height; // 0.10–0.40
  const r = (0.4 + ((h >> 8) % 30) / 100) * height; // 0.40–0.70
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="100%" height="100%" fill="${BG}"/>` +
    `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${ACCENT}" opacity="0.1"/>` +
    `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" ` +
    `font-family="Inter, Arial, sans-serif" font-weight="800" ` +
    `font-size="${Math.round(height * 0.16)}" letter-spacing="${Math.round(height * 0.02)}" fill="${ACCENT}">SASA</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
