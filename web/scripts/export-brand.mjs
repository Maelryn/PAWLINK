// Exports the PawLink logo as PNG/SVG for the team: node scripts/export-brand.mjs
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "../brand";
mkdirSync(OUT, { recursive: true });

const PAD = `<path fill-rule="evenodd" d="M50 90C43.6 82 31.5 72.2 31.5 60.5A18.5 18.5 0 1 1 68.5 60.5C68.5 72.2 56.4 82 50 90ZM43 60.5a7 7 0 1 0 14 0a7 7 0 1 0-14 0Z"/>
<ellipse cx="23.5" cy="41" rx="7.4" ry="9.4" transform="rotate(-26 23.5 41)"/><ellipse cx="39" cy="25.5" rx="8" ry="10.4" transform="rotate(-9 39 25.5)"/>
<ellipse cx="61" cy="25.5" rx="8" ry="10.4" transform="rotate(9 61 25.5)"/><ellipse cx="76.5" cy="41" rx="7.4" ry="9.4" transform="rotate(26 76.5 41)"/>`;

const icon = (dark) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs>
<linearGradient id="bg" x1="0" y1="0" x2="0.9" y2="1">${dark ? '<stop offset="0" stop-color="#1c1f3a"/><stop offset="1" stop-color="#0b0b14"/>' : '<stop offset="0" stop-color="#3aa0ff"/><stop offset="0.55" stop-color="#3b6cf6"/><stop offset="1" stop-color="#6a4cf0"/>'}</linearGradient>
<radialGradient id="gl" cx="0.82" cy="0.95" r="0.7"><stop offset="0" stop-color="${dark ? "#5e5ce6" : "#ff5b8a"}" stop-opacity="${dark ? 0.55 : 0.85}"/><stop offset="1" stop-color="#ff5b8a" stop-opacity="0"/></radialGradient>
<radialGradient id="hl" cx="0.3" cy="0.05" r="0.75"><stop offset="0" stop-color="#fff" stop-opacity="${dark ? 0.12 : 0.55}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="mk" x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#2f8cff"/><stop offset="0.55" stop-color="#7d7aff"/><stop offset="1" stop-color="#ff375f"/></linearGradient></defs>
<rect width="120" height="120" rx="27" fill="url(#bg)"/><rect width="120" height="120" rx="27" fill="url(#gl)"/><rect width="120" height="120" rx="27" fill="url(#hl)"/>
<g transform="translate(17 15) scale(0.86)" fill="${dark ? "url(#mk)" : "#fff"}">${PAD}</g></svg>`;

const mark = (fill, defs = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 10 80 85">${defs}<g fill="${fill}">${PAD}</g></svg>`;
const grad = `<defs><linearGradient id="g" x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#2f8cff"/><stop offset="0.55" stop-color="#5e5ce6"/><stop offset="1" stop-color="#ff2d78"/></linearGradient></defs>`;

const wordmark = (dark) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 140">
<g transform="translate(10 10)">${icon(false).replace(/<svg[^>]*>/, "<svg viewBox='0 0 120 120' width='120' height='120'>")}</g>
<text x="152" y="95" font-family="Segoe UI, Inter, Helvetica, Arial, sans-serif" font-size="74" font-weight="700" letter-spacing="-2" fill="${dark ? "#f5f5f7" : "#1d1d1f"}">Paw<tspan fill="${dark ? "#0a84ff" : "#0a7cff"}">Link</tspan></text></svg>`;

const files = {
  "pawlink-icon-light": [icon(false), 1024],
  "pawlink-icon-dark": [icon(true), 1024],
  "pawlink-mark-gradient": [mark("url(#g)", grad), 1024],
  "pawlink-mark-white": [mark("#ffffff"), 1024],
  "pawlink-mark-black": [mark("#1d1d1f"), 1024],
  "pawlink-wordmark-light-bg": [wordmark(false), 2080],
  "pawlink-wordmark-dark-bg": [wordmark(true), 2080],
};
for (const [name, [svg, w]] of Object.entries(files)) {
  writeFileSync(`${OUT}/${name}.svg`, svg);
  await sharp(Buffer.from(svg), { density: 600 }).resize({ width: w }).png().toFile(`${OUT}/${name}.png`);
}
console.log("exported to", OUT);
