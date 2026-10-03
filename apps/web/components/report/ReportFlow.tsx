"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Camera, Check, ImagePlus, LocateFixed, MapPin, Minus, Plus, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { AICard } from "@/components/cases/AICard";
import { TopNav } from "@/components/layout/TopNav";
import { MapView } from "@/components/map";
import { Button } from "@/components/ui/Button";
import { Emoji3D } from "@/components/ui/primitives";
import { TrustBadge } from "@/components/cases/Trust";
import { toast } from "sonner";
import { useSession } from "@/lib/auth";
import { computeTrust, inAlgeria } from "@/lib/trust";
import { useDevicePosition } from "@/components/layout/GeoGate";
import { analyzeAsync } from "@/lib/ai/analyze";
import { useI18n } from "@/lib/i18n";
import { ALL_SPECIES, LIVESTOCK, SPECIES_EMOJI, TRIAGE_COLOR } from "@/lib/species";
import { store, useStore } from "@/lib/store";
import type { AIAnalysis, Case, GeoPoint, Species } from "@/lib/types";
import { CASES } from "@/lib/mock/data";
import { cn, distanceKm } from "@/lib/utils";

const DEMO_PHOTOS = ["/mock/dog-brown.jpg", "/mock/goat-1.jpg", "/mock/cat-bw.jpg", "/mock/sheep-1.jpg"];
const TAGS = ["injured", "bleeding", "burned", "trapped", "smoke", "breathing", "lost", "abandoned", "thin", "dehydrated", "limping", "not-eating", "eyes", "sneezing", "skin", "coughing", "young", "needs-food"];
const DEFAULT_POINT: GeoPoint = { lat: 36.6455, lng: 4.1979, address: "Larbaâ Nath Irathen, Tizi Ouzou" };

type Phase = "form" | "analyzing" | "result";
/** You must be this close to the animal to report it. */
const MAX_KM = 2;
type Exif = { gps: GeoPoint | null; date: Date | null; old?: boolean };

/** Name the spot after the closest known locality (stand-in for reverse geocoding). */
function nearestPlace(p: GeoPoint) {
  const best = CASES.filter((c) => c.location.address)
    .map((c) => ({ a: c.location.address!, d: distanceKm(p, c.location) }))
    .sort((x, y) => x.d - y.d)[0];
  return best && best.d < 15 ? best.a : `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
}

export function ReportFlow() {
  const { t } = useI18n();
  const router = useRouter();
  const me = useSession()!;
  const allCases = useStore((s) => s.cases);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [phase, setPhase] = useState<Phase>("form");

  const [photo, setPhoto] = useState<string | null>(null);
  const [exif, setExif] = useState<Exif | null>(null);
  // Position checked by <GeoGate>: the reporter must be in Algeria and near the animal.
  const device = useDevicePosition() ?? DEFAULT_POINT;
  const [point, setPoint] = useState<GeoPoint>(device);
  const distFromMe = distanceKm(device, point);
  const [address, setAddress] = useState("");
  const [species, setSpecies] = useState<Species | null>(null);
  const [count, setCount] = useState(1);
  const [tags, setTags] = useState<string[]>([]);
  const [desc, setDesc] = useState("");
  const [ai, setAi] = useState<AIAnalysis | null>(null);
  const [created, setCreated] = useState<Case | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [phase, step]);

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };
  const canNext = [true, distFromMe <= MAX_KM, !!species, tags.length > 0 || desc.trim().length > 6][step];

  const submit = async () => {
    const location = { ...point, address: address || point.address || nearestPlace(point) };
    if (!inAlgeria(location)) return toast.error(t.trust.outside);
    if (distFromMe > MAX_KM) return toast.error(t.geo.tooFar(t.common.km(distFromMe)));
    const recentReports = store.recentReportsBy(me.id);
    if (recentReports >= 5) return toast.error(t.trust.tooMany);
    const trust = computeTrust({
      user: me,
      location,
      hasPhoto: !!photo,
      exifGps: exif?.gps,
      exifDate: exif?.date,
      device,
      duplicatePhoto: !!photo && photo.startsWith("data:") && allCases.some((c) => c.photos.includes(photo)),
      recentReports,
    });
    setPhase("analyzing");
    const result = await analyzeAsync({ species: species!, count, description: desc, conditionTags: tags, location }, t, 3600);
    const c: Case = {
      id: `new-${Date.now()}`,
      title: `${t.common.species[species!]} — ${tags.slice(0, 2).map((x) => t.common.tags[x]).join(", ") || t.report.title}`,
      species: species!,
      category: LIVESTOCK.includes(species!) ? "livestock" : "companion",
      count: count > 1 ? count : undefined,
      status: "open",
      triage: result.triage,
      location,
      photos: photo ? [photo] : [],
      description: desc || tags.map((x) => t.common.tags[x]).join(", "),
      conditionTags: tags,
      reporter: { id: me.id, name: me.name, avatar: me.avatar },
      ai: result,
      emergencyZoneId: Math.abs(location.lat - 36.632) < 0.07 && Math.abs(location.lng - 4.205) < 0.11 ? "z1" : undefined,
      reporterOnSite: true,
      trust,
      moderation: trust.level === "suspicious" ? "pending" : "approved",
      helpers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.addCase(c);
    setAi(result);
    setCreated(c);
    setPhase("result");
  };

  const publish = (to: "map" | "case") => {
    if (!created) return;
    router.push(to === "map" ? "/map" : `/cases/${created.id}`);
  };

  const reset = () => {
    setPhase("form");
    setStep(0);
    setPhoto(null);
    setExif(null);
    setSpecies(null);
    setCount(1);
    setTags([]);
    setDesc("");
    setAddress("");
    setAi(null);
    setCreated(null);
  };

  return (
    <div className="relative min-h-[100svh] overflow-hidden">
      <TopNav />
      <Backdrop triage={ai?.triage} />

      <div className="relative z-10 mx-auto max-w-[620px] px-4 pb-36 pt-24 sm:pt-28">
        <AnimatePresence mode="wait">
          {phase === "form" && (
            <motion.div key="form" exit={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }} transition={{ duration: 0.35 }}>
              <div className="mb-6 flex items-center justify-between">
                <Link href="/" className="glass flex h-10 w-10 items-center justify-center rounded-full" aria-label={t.common.close}>
                  <X className="h-5 w-5" />
                </Link>
                <Progress step={step} labels={t.report.steps} onJump={(n) => n < step && go(n)} />
                <span className="w-10" />
              </div>

              <div className="glass-strong relative overflow-hidden rounded-[36px] p-5 sm:p-7">
                <AnimatePresence mode="wait" custom={dir} initial={false}>
                  <motion.div
                    key={step}
                    custom={dir}
                    initial={{ x: dir * 60, opacity: 0, filter: "blur(6px)" }}
                    animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
                    exit={{ x: dir * -60, opacity: 0, filter: "blur(6px)" }}
                    transition={{ type: "spring", stiffness: 320, damping: 32 }}
                  >
                    {step === 0 && <PhotoStep photo={photo} setPhoto={setPhoto} exif={exif} setExif={setExif} point={point} />}
                    {step === 1 && <LocationStep point={point} setPoint={setPoint} address={address} setAddress={setAddress} device={device} />}
                    {step === 2 && <AnimalStep species={species} setSpecies={setSpecies} count={count} setCount={setCount} />}
                    {step === 3 && <SituationStep tags={tags} setTags={setTags} desc={desc} setDesc={setDesc} />}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-5 flex gap-3">
                {step > 0 && (
                  <Button variant="glass" size="lg" onClick={() => go(step - 1)} aria-label={t.common.back}>
                    <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
                  </Button>
                )}
                {step < 3 ? (
                  <Button size="lg" className="flex-1" disabled={!canNext} onClick={() => go(step + 1)}>
                    {step === 0 && !photo ? t.report.photoSkip : t.common.next}
                  </Button>
                ) : (
                  <Button size="lg" className="flex-1" disabled={!canNext} onClick={submit}>
                    <Emoji3D src="/3d/sparkles.png" size={22} /> {t.report.submit}
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {phase === "analyzing" && (
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.05, filter: "blur(12px)" }} transition={{ duration: 0.5 }}>
              <Analyzing photo={photo} species={species!} />
            </motion.div>
          )}

          {phase === "result" && ai && created && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Result ai={ai} c={created} onPublish={publish} onReset={reset} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ───────────────────── pieces ───────────────────── */

function Backdrop({ triage }: { triage?: AIAnalysis["triage"] }) {
  const color = triage ? TRIAGE_COLOR[triage] : null;
  return (
    <div className="pointer-events-none absolute inset-0">
      <motion.div
        className="absolute -left-40 -top-40 h-[620px] w-[620px] rounded-full blur-[110px]"
        animate={{ background: color ?? "rgba(10,124,255,0.28)", opacity: color ? 0.35 : 1 }}
        transition={{ duration: 1.2 }}
      />
      <motion.div
        className="absolute -bottom-40 -right-40 h-[620px] w-[620px] rounded-full blur-[120px]"
        animate={{ background: color ?? "rgba(255,45,120,0.2)", opacity: color ? 0.3 : 1 }}
        transition={{ duration: 1.2 }}
      />
    </div>
  );
}

function Progress({ step, labels, onJump }: { step: number; labels: string[]; onJump: (n: number) => void }) {
  return (
    <div className="glass flex items-center gap-1 rounded-full p-1">
      {labels.map((l, i) => (
        <button
          key={l}
          type="button"
          onClick={() => onJump(i)}
          className={cn("relative flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-colors", i === step ? "text-white" : i < step ? "text-accent" : "text-label-2")}
        >
          {i === step && <motion.span layoutId="step-pill" className="absolute inset-0 -z-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
          <span className="relative z-10 flex items-center gap-1">
            {i < step ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <span className="tabular-nums">{i + 1}</span>}
            <span className={cn(i === step ? "inline" : "hidden sm:inline")}>{l}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function StepHeader({ emoji, title, body }: { emoji: string; title: string; body?: string }) {
  return (
    <div className="mb-5 flex items-start gap-3.5">
      <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.05 }}>
        <Emoji3D src={emoji} size={52} />
      </motion.div>
      <div>
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.03em]">{title}</h1>
        {body && <p className="mt-1 text-[14.5px] text-label-2">{body}</p>}
      </div>
    </div>
  );
}

function PhotoStep({
  photo,
  setPhoto,
  exif,
  setExif,
  point,
}: {
  photo: string | null;
  setPhoto: (p: string | null) => void;
  exif: Exif | null;
  setExif: (e: Exif | null) => void;
  point: GeoPoint;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const read = async (f?: File) => {
    if (!f || !f.type.startsWith("image/")) return;
    const r = new FileReader();
    r.onload = () => setPhoto(r.result as string);
    r.readAsDataURL(f);
    // Read GPS + capture date from the photo's EXIF (the backend re-checks server-side).
    try {
      const exifr = (await import("exifr")).default;
      const meta = await exifr.parse(f, { gps: true, pick: ["DateTimeOriginal", "latitude", "longitude"] });
      setExif({
        gps: meta?.latitude ? { lat: meta.latitude, lng: meta.longitude } : null,
        date: meta?.DateTimeOriginal ? new Date(meta.DateTimeOriginal) : null,
        old: !!meta?.DateTimeOriginal && Date.now() - new Date(meta.DateTimeOriginal).getTime() > 48 * 3_600_000,
      });
    } catch {
      setExif({ gps: null, date: null });
    }
  };
  const exifNote = exif
    ? exif.gps
      ? t.trust.exifFound(t.common.km(distanceKm(exif.gps, point)))
      : exif.old
        ? t.trust.exifOld
        : t.trust.exifNone
    : null;
  return (
    <div>
      <StepHeader emoji="/3d/camera.png" title={t.report.photoTitle} body={t.report.photoBody} />
      <AnimatePresence mode="wait">
        {photo ? (
          <motion.div key="p" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative h-72 overflow-hidden rounded-[28px]">
            <Image src={photo} alt="" fill className="object-cover" unoptimized={photo.startsWith("data:")} sizes="600px" />
            <motion.div className="absolute inset-0 bg-white" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.5 }} />
            <button type="button" onClick={() => { setPhoto(null); setExif(null); }} className="glass absolute end-3 top-3 flex h-9 w-9 items-center justify-center rounded-full">
              <X className="h-4 w-4" />
            </button>
            <div className="glass absolute bottom-3 start-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold">
              <Check className="h-3.5 w-3.5 text-stable" strokeWidth={3} /> Cloudinary · 1.2 MB → 180 KB
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="d"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              read(e.dataTransfer.files[0]);
            }}
            className={cn(
              "flex h-56 w-full flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed transition-colors",
              drag ? "border-accent bg-accent-soft" : "border-separator bg-surface-2/60 hover:bg-surface-2",
            )}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_20px_-6px_var(--accent)]">
              <ImagePlus className="h-6 w-6" />
            </span>
            <span className="max-w-[260px] text-center text-[14.5px] font-medium text-label-2">{t.report.photoDrop}</span>
          </motion.button>
        )}
      </AnimatePresence>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => read(e.target.files?.[0])} />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => read(e.target.files?.[0])} />
      {photo && exifNote && <p className="mt-3 text-[13px] text-label-2">📍 {exifNote}</p>}
      {!photo && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="tinted" onClick={() => camera.current?.click()}>
            <Camera className="h-4 w-4" /> {t.trust.takePhoto}
          </Button>
          <Button variant="glass" onClick={() => input.current?.click()}>
            <ImagePlus className="h-4 w-4" /> {t.trust.chooseFile}
          </Button>
        </div>
      )}
      {!photo && (
        <div className="mt-5">
          <div className="mb-2 text-[13px] font-medium text-label-2">{t.report.photoOr}</div>
          <div className="flex gap-2">
            {DEMO_PHOTOS.map((p, i) => (
              <motion.button
                key={p}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => setPhoto(p)}
                className="relative h-16 w-16 overflow-hidden rounded-[16px] ring-1 ring-black/5"
              >
                <Image src={p} alt="" fill className="object-cover" sizes="64px" />
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LocationStep({ point, setPoint, address, setAddress, device }: { point: GeoPoint; setPoint: (p: GeoPoint) => void; address: string; setAddress: (a: string) => void; device: GeoPoint }) {
  const { t } = useI18n();
  const mapRef = useRef<MapRef | null>(null);
  const [moving, setMoving] = useState(false);
  const dist = distanceKm(device, point);
  const tooFar = dist > MAX_KM;

  const locate = () => {
    setPoint(device);
    mapRef.current?.flyTo({ center: [device.lng, device.lat], zoom: 15, duration: 1200 });
  };

  return (
    <div>
      <StepHeader emoji="/3d/pin.png" title={t.report.locationTitle} body={t.report.locationBody} />
      <div className="relative h-72 overflow-hidden rounded-[28px] ring-1 ring-black/5">
        <MapView
          cases={[]}
          initialView={{ longitude: point.lng, latitude: point.lat, zoom: 14.5, pitch: 30 }}
          userLocation={device}
          onReady={(m) => {
            mapRef.current = m;
            const map = m.getMap();
            map.on("movestart", () => setMoving(true));
            map.on("moveend", () => {
              const c = map.getCenter();
              setPoint({ lat: c.lat, lng: c.lng });
              setMoving(false);
            });
          }}
        />
        {/* center pin (map moves underneath, like Apple Maps "Mark my location") */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
          <motion.div animate={{ y: moving ? -14 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 20 }} className="flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-white bg-urgent shadow-[0_10px_20px_-6px_rgba(255,59,48,0.7)]">
              <MapPin className="h-5 w-5 text-white" strokeWidth={2.6} />
            </div>
            <span className="h-3 w-[3px] rounded-full bg-urgent" />
          </motion.div>
          <motion.span
            animate={{ scale: moving ? 0.6 : 1, opacity: moving ? 0.3 : 0.6 }}
            className="absolute -bottom-1 left-1/2 h-2 w-5 -translate-x-1/2 rounded-full bg-black/40 blur-[2px]"
          />
        </div>
        <button type="button" onClick={locate} className="glass absolute bottom-3 end-3 flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold">
          <LocateFixed className="h-4 w-4 text-accent" />
          {t.geo.youAreHere}
        </button>
        <div className="glass absolute start-3 top-3 rounded-full px-3 py-1.5 font-mono text-[11.5px] tabular-nums text-label-2" dir="ltr">
          {point.lat.toFixed(5)}°, {point.lng.toFixed(5)}°
        </div>
      </div>
      <div className={cn("mt-3 rounded-[16px] px-4 py-2.5 text-[13.5px] font-semibold", tooFar ? "bg-urgent-soft text-urgent" : "bg-stable-soft text-stable")}>
        {tooFar ? t.geo.tooFar(t.common.km(dist)) : t.geo.near}
      </div>
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder={t.report.addressPlaceholder}
        className="mt-3 h-12 w-full rounded-[16px] bg-surface-2 px-4 text-[15px] outline-none ring-accent/40 placeholder:text-label-2 focus:ring-2"
      />
    </div>
  );
}

function AnimalStep({ species, setSpecies, count, setCount }: { species: Species | null; setSpecies: (s: Species) => void; count: number; setCount: (n: number) => void }) {
  const { t } = useI18n();
  return (
    <div>
      <StepHeader emoji="/3d/paw.png" title={t.report.animalTitle} />
      <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
        {ALL_SPECIES.map((s, i) => {
          const on = species === s;
          return (
            <motion.button
              key={s}
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03, type: "spring", stiffness: 300, damping: 20 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setSpecies(s)}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-[20px] py-3 text-[12.5px] font-semibold transition-colors",
                on ? "bg-accent-soft text-accent ring-2 ring-accent" : "bg-surface-2/70 hover:bg-surface-2",
              )}
            >
              <motion.span animate={on ? { scale: [1, 1.25, 1.1], rotate: [0, -10, 0] } : { scale: 1 }} transition={{ duration: 0.45 }}>
                <Emoji3D src={SPECIES_EMOJI[s]} size={42} />
              </motion.span>
              {t.common.species[s]}
            </motion.button>
          );
        })}
      </div>
      <div className="mt-5 flex items-center justify-between rounded-[20px] bg-surface-2/70 px-4 py-3">
        <span className="text-[15px] font-semibold">{t.report.countLabel}</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setCount(Math.max(1, count - 1))} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-sm">
            <Minus className="h-4 w-4" />
          </button>
          <motion.span key={count} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-8 text-center text-[20px] font-bold tabular-nums">
            {count}
          </motion.span>
          <button type="button" onClick={() => setCount(count + 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-sm">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SituationStep({ tags, setTags, desc, setDesc }: { tags: string[]; setTags: (t: string[]) => void; desc: string; setDesc: (d: string) => void }) {
  const { t } = useI18n();
  const toggle = (x: string) => setTags(tags.includes(x) ? tags.filter((y) => y !== x) : [...tags, x]);
  const urgentTags = ["injured", "bleeding", "burned", "trapped", "smoke", "breathing"];
  return (
    <div>
      <StepHeader emoji="/3d/bandage.png" title={t.report.situationTitle} body={t.report.situationBody} />
      <div className="flex flex-wrap gap-2">
        {TAGS.map((x) => {
          const on = tags.includes(x);
          const hot = urgentTags.includes(x);
          return (
            <motion.button
              key={x}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => toggle(x)}
              className={cn(
                "h-9 rounded-full px-3.5 text-[13.5px] font-semibold transition-colors",
                on ? (hot ? "bg-urgent text-white" : "bg-label text-bg") : "bg-surface-2/80 hover:bg-surface-2",
              )}
            >
              {t.common.tags[x]}
            </motion.button>
          );
        })}
      </div>
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        rows={4}
        placeholder={t.report.descPlaceholder}
        className="mt-4 w-full resize-none rounded-[20px] bg-surface-2 p-4 text-[15px] leading-relaxed outline-none ring-accent/40 placeholder:text-label-2 focus:ring-2"
      />
      <p className="mt-3 text-[12.5px] text-label-2">🛡️ {t.trust.why}</p>
    </div>
  );
}

function Analyzing({ photo, species }: { photo: string | null; species: Species }) {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const steps = [...t.report.analyzeSteps.slice(0, 2), t.trust.checking, ...t.report.analyzeSteps.slice(2)];
  useEffect(() => {
    const id = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 700);
    return () => clearInterval(id);
  }, [steps.length]);
  return (
    <div className="flex flex-col items-center pt-6 text-center">
      <div className="relative h-64 w-64">
        {/* rotating gradient halo */}
        <motion.div
          className="absolute -inset-6 rounded-full opacity-80 blur-2xl"
          style={{ background: "conic-gradient(from 0deg, #0a7cff, #5e5ce6, #ff2d55, #ff9500, #0a7cff)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute -inset-[3px] rounded-[64px]"
          style={{ background: "conic-gradient(from 0deg, #0a7cff, #5e5ce6, #ff2d55, #ff9500, #0a7cff)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
        <div className="relative h-full w-full overflow-hidden rounded-[62px] bg-surface">
          {photo ? (
            <Image src={photo} alt="" fill className="object-cover" unoptimized={photo.startsWith("data:")} sizes="256px" />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#fff7ea] to-[#ffd9b8]">
              <Emoji3D src={SPECIES_EMOJI[species]} size={130} />
            </div>
          )}
          <motion.div
            className="absolute inset-x-0 h-20 bg-gradient-to-b from-transparent via-white/70 to-transparent mix-blend-overlay"
            animate={{ top: ["-25%", "105%"] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* detection brackets */}
          {[0, 1, 2, 3].map((k) => (
            <motion.span
              key={k}
              className={cn(
                "absolute h-8 w-8 border-white",
                k === 0 && "left-8 top-8 rounded-tl-xl border-l-[3px] border-t-[3px]",
                k === 1 && "right-8 top-8 rounded-tr-xl border-r-[3px] border-t-[3px]",
                k === 2 && "bottom-8 left-8 rounded-bl-xl border-b-[3px] border-l-[3px]",
                k === 3 && "bottom-8 right-8 rounded-br-xl border-b-[3px] border-r-[3px]",
              )}
              animate={{ scale: [1, 0.85, 1], opacity: [0.9, 0.5, 0.9] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: k * 0.1 }}
            />
          ))}
        </div>
      </div>
      <div className="mt-10 text-[28px] font-bold tracking-[-0.03em]">
        <span className="shimmer-text">{t.report.analyzing}</span>
      </div>
      <div className="mt-5 w-full max-w-[340px] space-y-2.5 text-start">
        {steps.map((s, k) => (
          <motion.div key={s} initial={{ opacity: 0, x: -10 }} animate={{ opacity: k <= i ? 1 : 0.35, x: 0 }} transition={{ delay: k * 0.08 }} className="flex items-center gap-3 text-[15px]">
            <span className="relative flex h-6 w-6 items-center justify-center">
              {k < i ? (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex h-6 w-6 items-center justify-center rounded-full bg-stable text-white">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </motion.span>
              ) : k === i ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-label-3" />
              )}
            </span>
            {s}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Result({ ai, c, onPublish, onReset }: { ai: AIAnalysis; c: Case; onPublish: (to: "map" | "case") => void; onReset: () => void }) {
  const pending = c.moderation === "pending";
  const { t } = useI18n();
  const color = TRIAGE_COLOR[ai.triage];
  return (
    <div>
      {/* color flood */}
      <motion.div
        className="pointer-events-none fixed inset-0 z-0"
        initial={{ clipPath: "circle(0% at 50% 30%)", opacity: 0.9 }}
        animate={{ clipPath: "circle(150% at 50% 30%)", opacity: 0 }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        style={{ background: color }}
      />
      <motion.div
        initial={{ scale: 0.4, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.2 }}
        className="relative flex flex-col items-center text-center"
      >
        <div className="relative">
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: color }}
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 2.2, opacity: 0 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)]" style={{ background: color }}>
            <Emoji3D src={ai.triage === "urgent" ? "/3d/ambulance.png" : ai.triage === "monitoring" ? "/3d/owl.png" : "/3d/heart.png"} size={58} />
          </div>
        </div>
        <div className="mt-5 text-[14px] font-semibold uppercase tracking-wider text-label-2">{t.ai.triageLabel}</div>
        <div className="text-[56px] font-bold leading-none tracking-[-0.045em]" style={{ color }}>
          {t.common.triage[ai.triage]}
        </div>
        {pending ? (
          <div className="mt-3 max-w-[460px] rounded-[18px] bg-monitor-soft px-4 py-2.5 text-[13.5px] font-medium text-monitor">
            <b>{t.trust.pendingTitle}.</b> {t.trust.pending}
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 rounded-full bg-stable-soft px-3.5 py-1.5 text-[13.5px] font-semibold text-stable">
            <Check className="h-4 w-4" strokeWidth={3} /> {t.report.sent} · {t.report.sentBody}
          </div>
        )}
        {c.trust && <TrustBadge level={c.trust.level} className="mt-2" />}
      </motion.div>

      <AICard ai={ai} reveal className="relative mt-8" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6 }} className="relative mt-6 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" className="flex-1" disabled={pending} onClick={() => onPublish("map")}>
          <Emoji3D src="/3d/pin.png" size={22} /> {t.report.viewOnMap}
        </Button>
        <Button size="lg" variant="glass" className="flex-1" onClick={() => onPublish("case")}>
          {t.report.viewCase}
        </Button>
      </motion.div>
      <div className="relative mt-4 text-center">
        <Button variant="plain" size="sm" className="mx-auto" onClick={onReset}>
          {t.report.newReport}
        </Button>
      </div>
    </div>
  );
}
