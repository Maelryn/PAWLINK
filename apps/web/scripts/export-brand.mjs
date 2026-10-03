// Exports the PawLink icon everywhere it's used: node scripts/export-brand.mjs
// - public/brand/*.svg (used by the <AppIcon/> component), app/icon.svg (favicon)
// - ../../brand/*.png|svg (files for the team / slides)
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { appIconSvg } from "../components/brand/iconSvg.ts";

const light = appIconSvg();
const dark = appIconSvg({ dark: true });

mkdirSync("public/brand", { recursive: true });
writeFileSync("public/brand/app-icon.svg", light);
writeFileSync("public/brand/app-icon-dark.svg", dark);
writeFileSync("app/icon.svg", light);

const OUT = "../../brand";
mkdirSync(OUT, { recursive: true });
for (const [name, svg] of [["pawlink-icon-light", light], ["pawlink-icon-dark", dark]]) {
  writeFileSync(`${OUT}/${name}.svg`, svg);
  await sharp(Buffer.from(svg), { density: 900 }).resize(1024, 1024).png().toFile(`${OUT}/${name}.png`);
}
console.log("brand exported");
