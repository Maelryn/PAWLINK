// Trims transparent margins of the cut-out pet photos and converts them to WebP: node scripts/trim-pets.mjs
import sharp from "sharp";
import { readdirSync, unlinkSync } from "node:fs";
const dir = "public/pets";
for (const f of readdirSync(dir).filter((x) => x.endsWith(".png"))) {
  await sharp(`${dir}/${f}`).trim({ threshold: 5 }).resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true }).webp({ quality: 86, alphaQuality: 90 }).toFile(`${dir}/${f.replace(".png", ".webp")}`);
  unlinkSync(`${dir}/${f}`);
}
console.log("ok");
