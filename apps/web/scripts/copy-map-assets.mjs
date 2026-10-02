// Copies MapLibre's worker (ES module) and the RTL text plugin into /public so they are served as static files.
import { copyFileSync, mkdirSync } from "node:fs";

const out = "public/maplibre";
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(`node_modules/maplibre-gl/dist/${f}`, `${out}/${f}`);
copyFileSync("node_modules/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js", `${out}/rtl-text.js`);
console.log("map assets copied");
