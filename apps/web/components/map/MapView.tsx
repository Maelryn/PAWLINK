"use client";

import { useTheme } from "@/lib/theme";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, Source, type MapRef, type ViewState } from "react-map-gl/maplibre";
import { getRTLTextPluginStatus, setRTLTextPlugin, setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import Supercluster from "supercluster";
import { useI18n } from "@/lib/i18n";
import { TRIAGE_ORDER } from "@/lib/species";
import type { Case, EmergencyZone, GeoPoint, Service, Species, Triage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ALGERIA_VIEW, buildStyle, loadBaseStyle } from "./mapStyle";
import { CasePin, ClusterPin, FireMarker, ServicePin, UserDot } from "./Pins";

// The bundler can't resolve MapLibre's worker, so it is served from /public (see scripts/copy-map-assets.mjs).
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
  if (getRTLTextPluginStatus() === "unavailable") setRTLTextPlugin("/maplibre/rtl-text.js", true).catch(() => {});
}


type PointProps = { id: string; triage: Triage; species: Species };

export interface MapViewProps {
  cases: Case[];
  services?: Service[];
  zone?: EmergencyZone | null;
  selectedId?: string | null;
  selectedServiceId?: string | null;
  onSelectCase?: (id: string | null) => void;
  onSelectService?: (id: string | null) => void;
  initialView?: Partial<ViewState>;
  interactive?: boolean;
  dropInId?: string | null;
  userLocation?: GeoPoint | null;
  showLabels?: boolean;
  onReady?: (map: MapRef) => void;
  onMoveEnd?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function MapView({
  cases,
  services,
  zone,
  selectedId,
  selectedServiceId,
  onSelectCase,
  onSelectService,
  initialView,
  interactive = true,
  dropInId,
  userLocation,
  showLabels,
  onReady,
  onMoveEnd,
  className,
  children,
}: MapViewProps) {
  const { resolved: theme } = useTheme();
  const { locale } = useI18n();
  const mapRef = useRef<MapRef | null>(null);
  const [base, setBase] = useState<StyleSpecification | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState({ zoom: initialView?.zoom ?? ALGERIA_VIEW.zoom, bounds: null as [number, number, number, number] | null });

  useEffect(() => {
    loadBaseStyle().then(setBase).catch(() => setBase(null));
  }, []);

  const style = useMemo(() => (base ? buildStyle(base, theme, locale) : null), [base, theme, locale]);

  /* ── clustering ── */
  const index = useMemo(() => {
    const sc = new Supercluster<PointProps>({ radius: 64, maxZoom: 12, minPoints: 3 });
    sc.load(
      cases.map((c) => ({
        type: "Feature" as const,
        properties: { id: c.id, triage: c.triage, species: c.species },
        geometry: { type: "Point" as const, coordinates: [c.location.lng, c.location.lat] },
      })),
    );
    return sc;
  }, [cases]);

  const clusters = useMemo(() => {
    const b = view.bounds ?? [-9, 18, 12, 38];
    return index.getClusters(b, Math.floor(view.zoom));
  }, [index, view]);

  const caseById = useMemo(() => Object.fromEntries(cases.map((c) => [c.id, c])), [cases]);

  const syncView = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;
    const b = m.getBounds();
    setView({ zoom: m.getZoom(), bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] });
  }, []);

  /* ── emergency zone breathing glow ── */
  useEffect(() => {
    if (!zone || !loaded) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const m = mapRef.current?.getMap();
      const k = (Math.sin((now - start) / 700) + 1) / 2;
      if (m?.getLayer("zone-fill")) {
        m.setPaintProperty("zone-fill", "fill-opacity", 0.12 + k * 0.14);
        m.setPaintProperty("zone-glow", "line-opacity", 0.35 + k * 0.45);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [zone, loaded]);

  const fires = useMemo(() => {
    if (!zone) return [];
    const ring = zone.polygon.coordinates[0];
    const c = zone.center;
    const pts = [ring[1], ring[3], ring[5], ring[7], ring[9]].map(([lng, lat]) => ({
      lng: lng + (c.lng - lng) * 0.18,
      lat: lat + (c.lat - lat) * 0.18,
    }));
    return [...pts, { lng: c.lng + 0.03, lat: c.lat + 0.02 }];
  }, [zone]);

  if (!style)
    return (
      <div className={cn("relative h-full w-full overflow-hidden bg-[#f4f2ed] dark:bg-[#1d1d20]", className)}>
        <div className="shimmer absolute inset-0 opacity-50" />
      </div>
    );

  return (
    <div className={cn("relative h-full w-full", className)}>
      <Map
        ref={(r) => {
          mapRef.current = r;
        }}
        initialViewState={{ ...ALGERIA_VIEW, ...initialView }}
        mapStyle={style}
        style={{ width: "100%", height: "100%" }}
        interactive={interactive}
        attributionControl={{ compact: true }}
        dragRotate={interactive}
        maxPitch={70}
        // Algeria only (+ a little sea): no more world map
        maxBounds={[-10.5, 17.5, 13.5, 38.8]}
        minZoom={4.2}
        renderWorldCopies={false}
        onLoad={() => {
          setLoaded(true);
          syncView();
          if (mapRef.current) onReady?.(mapRef.current);
        }}
        onMoveEnd={() => {
          syncView();
          onMoveEnd?.();
        }}
        onZoom={(e) => {
          if (Math.floor(e.viewState.zoom) !== Math.floor(view.zoom)) syncView();
        }}
        onClick={() => {
          onSelectCase?.(null);
          onSelectService?.(null);
        }}
      >
        {zone && (
          <Source id="zone" type="geojson" data={{ type: "Feature", properties: {}, geometry: zone.polygon }}>
            <Layer id="zone-fill" type="fill" paint={{ "fill-color": "#ff3b30", "fill-opacity": 0.18 }} />
            <Layer id="zone-glow" type="line" paint={{ "line-color": "#ff6a3d", "line-width": 14, "line-blur": 12, "line-opacity": 0.6 }} />
            <Layer id="zone-line" type="line" paint={{ "line-color": "#ff3b30", "line-width": 2.2, "line-dasharray": [2, 1.5] }} />
          </Source>
        )}

        {zone &&
          fires.map((f, i) => (
            <Marker key={`fire${i}`} longitude={f.lng} latitude={f.lat} anchor="bottom" style={{ zIndex: 1 }}>
              <FireMarker delay={i * 0.3} size={i === fires.length - 1 ? 42 : 30} />
            </Marker>
          ))}

        {services?.map((s) => (
          <Marker
            key={s.id}
            longitude={s.location.lng}
            latitude={s.location.lat}
            anchor="center"
            style={{ zIndex: selectedServiceId === s.id ? 40 : 2 }}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelectService?.(s.id);
            }}
          >
            <ServicePin s={s} selected={selectedServiceId === s.id} />
          </Marker>
        ))}

        {clusters.map((f) => {
          const [lng, lat] = f.geometry.coordinates;
          const props = f.properties as PointProps & { cluster?: boolean; cluster_id?: number; point_count?: number };
          if (props.cluster) {
            const leaves = index.getLeaves(props.cluster_id!, 50) as GeoJSON.Feature<GeoJSON.Point, PointProps>[];
            const worst = leaves.map((l) => l.properties.triage).sort((a, b) => TRIAGE_ORDER[a] - TRIAGE_ORDER[b])[0];
            const species = [...new Set(leaves.map((l) => l.properties.species))];
            return (
              <Marker
                key={`cl${props.cluster_id}`}
                longitude={lng}
                latitude={lat}
                anchor="center"
                style={{ zIndex: 20 }}
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  const z = Math.min(index.getClusterExpansionZoom(props.cluster_id!) + 0.5, 14);
                  mapRef.current?.flyTo({ center: [lng, lat], zoom: z, duration: 900, essential: true });
                }}
              >
                <ClusterPin count={props.point_count!} worst={worst} species={species} />
              </Marker>
            );
          }
          const c = caseById[props.id];
          if (!c) return null;
          const sel = selectedId === c.id;
          return (
            <Marker
              key={c.id}
              longitude={lng}
              latitude={lat}
              anchor="bottom"
              style={{ zIndex: sel ? 50 : c.triage === "urgent" ? 12 : 10 }}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelectCase?.(c.id);
              }}
            >
              <CasePin c={c} selected={sel} dropIn={dropInId === c.id} showLabel={showLabels} />
            </Marker>
          );
        })}

        {userLocation && (
          <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
            <UserDot />
          </Marker>
        )}
        {children}
      </Map>
    </div>
  );
}
