/* Polished, glossy app icon (same paw + pin identity). Shared by the favicon and the brand export. */

const PAD = "M50 90C43.6 82 31.5 72.2 31.5 60.5A18.5 18.5 0 1 1 68.5 60.5C68.5 72.2 56.4 82 50 90ZM43 60.5a7 7 0 1 0 14 0a7 7 0 1 0-14 0Z";
const TOES: [number, number, number, number, number][] = [
  [23.5, 41, 7.4, 9.4, -26],
  [39, 25.5, 8, 10.4, -9],
  [61, 25.5, 8, 10.4, 9],
  [76.5, 41, 7.4, 9.4, 26],
];

export function appIconSvg({ dark = false, size }: { dark?: boolean; size?: number } = {}) {
  const bg = dark
    ? `<stop offset="0" stop-color="#26304f"/><stop offset="0.55" stop-color="#141a33"/><stop offset="1" stop-color="#0b0d1c"/>`
    : `<stop offset="0" stop-color="#63ccff"/><stop offset="0.45" stop-color="#2f8cff"/><stop offset="1" stop-color="#4b55ec"/>`;
  const mark = dark
    ? `<stop offset="0" stop-color="#8fd0ff"/><stop offset="0.55" stop-color="#6c7dff"/><stop offset="1" stop-color="#e2489a"/>`
    : `<stop offset="0" stop-color="#ffffff"/><stop offset="0.55" stop-color="#f3f6ff"/><stop offset="1" stop-color="#cfd9ff"/>`;
  const toes = TOES.map(
    ([cx, cy, rx, ry, r]) =>
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${r} ${cx} ${cy})" fill="url(#mk)"/>` +
      `<ellipse cx="${cx - rx * 0.28}" cy="${cy - ry * 0.42}" rx="${rx * 0.34}" ry="${ry * 0.22}" transform="rotate(${r - 20} ${cx} ${cy})" fill="#fff" opacity="${dark ? 0.35 : 0.9}"/>`,
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"${size ? ` width="${size}" height="${size}"` : ""}>
<defs>
  <linearGradient id="bg" x1="0.1" y1="0" x2="0.85" y2="1">${bg}</linearGradient>
  <radialGradient id="glow" cx="0.88" cy="0.98" r="0.62"><stop offset="0" stop-color="#ff6aa8" stop-opacity="${dark ? 0.45 : 0.75}"/><stop offset="1" stop-color="#ff6aa8" stop-opacity="0"/></radialGradient>
  <radialGradient id="gloss" cx="0.32" cy="0" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="${dark ? 0.16 : 0.6}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <linearGradient id="base" x1="0" y1="0.55" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#001060" stop-opacity="${dark ? 0.3 : 0.18}"/></linearGradient>
  <radialGradient id="mk" cx="0.35" cy="0.25" r="0.95">${mark}</radialGradient>
  <radialGradient id="hole" cx="0.5" cy="0.35" r="0.7"><stop offset="0" stop-color="${dark ? "#1b2140" : "#2a6ff0"}"/><stop offset="1" stop-color="${dark ? "#0b0d1c" : "#1d4fd6"}"/></radialGradient>
  <filter id="sh" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="3.5" stdDeviation="3.2" flood-color="#0b1f75" flood-opacity="${dark ? 0.6 : 0.38}"/></filter>
  <clipPath id="sq"><rect width="120" height="120" rx="27"/></clipPath>
</defs>
<g clip-path="url(#sq)">
  <rect width="120" height="120" fill="url(#bg)"/>
  <rect width="120" height="120" fill="url(#glow)"/>
  <rect width="120" height="120" fill="url(#base)"/>
  <ellipse cx="44" cy="-6" rx="78" ry="44" fill="url(#gloss)"/>
</g>
<rect x="0.6" y="0.6" width="118.8" height="118.8" rx="26.5" fill="none" stroke="#fff" stroke-opacity="${dark ? 0.12 : 0.35}" stroke-width="1.2"/>
<g transform="translate(14 11) scale(0.92)" filter="url(#sh)">
  <circle cx="50" cy="60.5" r="7.6" fill="url(#hole)"/>
  <path d="${PAD}" fill="url(#mk)" fill-rule="evenodd"/>
  <ellipse cx="42" cy="51" rx="7" ry="3.6" transform="rotate(-24 42 51)" fill="#fff" opacity="${dark ? 0.3 : 0.85}"/>
  ${toes}
</g>
</svg>`;
}
