import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";

/* OpenFreeMap "liberty" (OSM vector tiles, free, no key) recolored to an Apple-Maps-like palette. */

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

type Palette = {
  bg: string; park: string; wood: string; grass: string; residential: string; water: string; sand: string;
  ice: string; building: string; building3d: string; motorway: string; motorwayCasing: string; primary: string;
  primaryCasing: string; secondary: string; minor: string; minorCasing: string; path: string; rail: string;
  label: string; labelStrong: string; halo: string; waterLabel: string; boundary: string; relief: number;
};

const LIGHT: Palette = {
  bg: "#f4f2ed", park: "#cdeabf", wood: "#d2ebc4", grass: "#dcefce", residential: "#eeebe5", water: "#9fd0f5",
  sand: "#f3ead3", ice: "#ffffff", building: "#e4e1db", building3d: "#e8e5df", motorway: "#ffd77a",
  motorwayCasing: "#e9b94f", primary: "#ffffff", primaryCasing: "#d9d4ca", secondary: "#ffffff", minor: "#ffffff",
  minorCasing: "#e2ddd4", path: "#dcd6cb", rail: "#d0ccc4", label: "#6b6b70", labelStrong: "#2c2c30",
  halo: "rgba(255,255,255,0.95)", waterLabel: "#4a8ec4", boundary: "#b9a9c9", relief: 0.35,
};

const DARK: Palette = {
  bg: "#1d1d20", park: "#1f3426", wood: "#1d3023", grass: "#22352a", residential: "#232327", water: "#0d2a42",
  sand: "#2b271f", ice: "#2a2d33", building: "#2b2b30", building3d: "#34343a", motorway: "#8d7444",
  motorwayCasing: "#5b4a2b", primary: "#4a4a50", primaryCasing: "#2a2a2e", secondary: "#414147", minor: "#38383d",
  minorCasing: "#26262a", path: "#3a3a40", rail: "#3a3a40", label: "#a1a1a8", labelStrong: "#e5e5ea",
  halo: "rgba(20,20,22,0.92)", waterLabel: "#5d9ccf", boundary: "#6c5f7a", relief: 0.18,
};

let baseStyle: StyleSpecification | null = null;
let pending: Promise<StyleSpecification> | null = null;

export async function loadBaseStyle() {
  if (baseStyle) return baseStyle;
  pending ??= fetch(STYLE_URL)
    .then((r) => r.json())
    .then((s: StyleSpecification) => (baseStyle = s));
  return pending;
}

export function buildStyle(base: StyleSpecification, theme: "light" | "dark", lang: "fr" | "en" | "ar"): StyleSpecification {
  const p = theme === "dark" ? DARK : LIGHT;
  const name: ExpressionSpecification = ["coalesce", ["get", `name:${lang}`], ["get", "name:latin"], ["get", "name"]];

  const layers = base.layers
    .filter((l) => !/^poi_|one_way|shield|highway-shield|road_shield|aeroway|airport|landuse_track|landuse_pitch|hatching|road_area_pattern/.test(l.id))
    .map((orig): LayerSpecification => {
      const l = structuredClone(orig) as LayerSpecification & { paint?: Record<string, unknown>; layout?: Record<string, unknown> };
      const paint = (l.paint ??= {});
      const id = l.id;

      switch (l.type) {
        case "background":
          paint["background-color"] = p.bg;
          break;
        case "raster":
          paint["raster-opacity"] = p.relief;
          break;
        case "fill": {
          let c: string | null = null;
          if (id === "park") c = p.park;
          else if (id === "landcover_wood") c = p.wood;
          else if (id === "landcover_grass" || id === "landcover_wetland" || id === "landuse_cemetery") c = p.grass;
          else if (id === "landuse_residential") c = p.residential;
          else if (id === "water") c = p.water;
          else if (id === "landcover_sand") c = p.sand;
          else if (id === "landcover_ice") c = p.ice;
          else if (id === "building") c = p.building;
          else if (id.startsWith("landuse_")) c = p.residential;
          if (c) {
            paint["fill-color"] = c;
            delete paint["fill-pattern"];
            delete paint["fill-outline-color"];
            if (id === "landcover_wood" || id === "landcover_grass") paint["fill-opacity"] = 0.8;
          }
          break;
        }
        case "fill-extrusion":
          paint["fill-extrusion-color"] = p.building3d;
          paint["fill-extrusion-opacity"] = theme === "dark" ? 0.9 : 0.85;
          break;
        case "line": {
          if (id.startsWith("waterway")) paint["line-color"] = p.water;
          else if (id.startsWith("boundary")) {
            paint["line-color"] = p.boundary;
            paint["line-opacity"] = 0.7;
          } else if (id === "park_outline") paint["line-opacity"] = 0;
          else if (/rail/.test(id)) paint["line-color"] = p.rail;
          else if (/path_pedestrian/.test(id)) paint["line-color"] = p.path;
          else if (/casing/.test(id)) paint["line-color"] = /motorway/.test(id) ? p.motorwayCasing : /trunk_primary|secondary/.test(id) ? p.primaryCasing : p.minorCasing;
          else if (/motorway/.test(id)) paint["line-color"] = p.motorway;
          else if (/trunk_primary/.test(id)) paint["line-color"] = p.primary;
          else if (/secondary_tertiary/.test(id)) paint["line-color"] = p.secondary;
          else if (/minor|street|link|service_track/.test(id)) paint["line-color"] = p.minor;
          if (id.startsWith("tunnel")) paint["line-opacity"] = 0.5;
          break;
        }
        case "symbol": {
          const layout = (l.layout ??= {});
          if (layout["text-field"]) layout["text-field"] = name;
          const strong = /city|capital|country|state/.test(id);
          paint["text-color"] = id.startsWith("water") ? p.waterLabel : strong ? p.labelStrong : p.label;
          paint["text-halo-color"] = p.halo;
          paint["text-halo-width"] = 1.4;
          paint["text-halo-blur"] = 0.3;
          break;
        }
      }
      return l;
    });

  return { ...base, layers };
}

export const ALGERIA_VIEW = { longitude: 3.4, latitude: 34.9, zoom: 5.6, pitch: 0, bearing: 0 };
