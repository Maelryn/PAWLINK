"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ImagePlus, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { TopNav } from "@/components/layout/TopNav";
import { GeoGate, useDevicePosition } from "@/components/layout/GeoGate";
import { Backdrop, Progress, StepHeader } from "@/components/report/ReportFlow";
import { Button } from "@/components/ui/Button";
import { Emoji3D, Segmented } from "@/components/ui/primitives";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { SPECIES_EMOJI } from "@/lib/species";
import { store } from "@/lib/store";
import type { AdoptionProfile, Species } from "@/lib/types";
import { cn } from "@/lib/utils";

const field = "h-[50px] w-full bg-transparent px-4 text-[16px] outline-none placeholder:text-label-3";
const group = "overflow-hidden rounded-[18px] bg-surface-2/70 divide-y divide-separator";
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const SPECIES: Species[] = ["dog", "cat", "rabbit", "bird", "horse", "donkey", "goat", "sheep"];
const DEMO_PHOTOS = ["/mock/dog-white.jpg", "/mock/dog-jack.jpg", "/mock/cat-orange.jpg", "/mock/cat-tabby.jpg"];

export default function NewAdoptionPage() {
  return (
    <Suspense>
      <Gate />
    </Suspense>
  );
}

/** New listings need a position in Algeria; editing keeps the listing's place. */
function Gate() {
  const editId = useSearchParams().get("edit");
  if (editId) return <NewAdoption editId={editId} />;
  return (
    <GeoGate>
      <NewAdoption />
    </GeoGate>
  );
}

function NewAdoption({ editId }: { editId?: string }) {
  const { t } = useI18n();
  const me = useSession()!;
  const router = useRouter();
  const here = useDevicePosition(); // checked to be in Algeria by <GeoGate>
  // editing: only the owner, and not once the animal found its family
  const [editing] = useState<AdoptionProfile | undefined>(() => store.get().adoptions.find((a) => a.id === editId && a.ownerId === me.id && a.status !== "adopted"));
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>(editing?.photos ?? []);
  const [checking, setChecking] = useState(false);
  const [f, setF] = useState({
    name: editing?.name ?? "",
    species: (editing?.species ?? "dog") as Species,
    breed: editing?.breed ?? "",
    sex: (editing?.sex ?? "male") as "male" | "female",
    age: editing ? String(editing.ageMonths) : "",
    health: editing?.healthStatus ?? "",
    vaccines: editing?.vaccinations.map((v) => v.name).join(", ") ?? "",
    behavior: editing?.behavior.join(", ") ?? "",
    care: editing?.careNeeds.join(", ") ?? "",
    story: editing?.story ?? "",
    city: editing?.location.address ?? me.city ?? "",
    phone: editing?.ownerPhone ?? me.phone ?? "",
  });
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  useEffect(() => {
    if (editId && !editing) router.replace("/account?tab=adoption");
  }, [editId, editing, router]);

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const canNext = [photos.length > 0, f.name.trim().length > 0 && Number(f.age) > 0, f.health.trim().length > 0, f.story.trim().length > 0 && f.city.trim().length > 0 && f.phone.replace(/\D/g, "").length >= 8][step];
  const titles = [t.market.stepPhotos, t.market.stepAbout, t.market.stepHealth, t.market.stepStory];
  const up = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  // Only real camera photos: a picture must carry camera EXIF (make/model or capture date).
  // The backend re-checks this, runs Gemini "is this a real animal photo?" and a duplicate (pHash) search.
  const add = async (files: FileList | null) => {
    if (!files) return;
    setChecking(true);
    const exifr = (await import("exifr")).default;
    const accepted: string[] = [];
    for (const file of Array.from(files)) {
      if (photos.length + accepted.length >= 3) {
        toast.error(t.market.maxPhotos);
        break;
      }
      const meta = await exifr.parse(file, ["Make", "Model", "DateTimeOriginal"]).catch(() => null);
      if (!meta?.Make && !meta?.DateTimeOriginal) {
        toast.error(t.market.photoRejected);
        continue;
      }
      accepted.push(await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file); }));
    }
    setPhotos((p) => [...p, ...accepted]);
    setChecking(false);
  };

  const submit = () => {
    if (!photos.length) return toast.error(t.market.photosRule);
    const now = new Date().toISOString();
    const details = {
      name: f.name.trim(),
      species: f.species,
      breed: f.breed.trim() || undefined,
      sex: f.sex,
      ageMonths: Number(f.age) || 1,
      photos,
      healthStatus: f.health.trim(),
      behavior: list(f.behavior),
      careNeeds: list(f.care),
      story: f.story.trim(),
      ownerPhone: f.phone.trim() || me.phone,
    };
    if (editing) {
      // a second review: the public version stays until a moderator approves the change
      const old = new Map(editing.vaccinations.map((v) => [v.name, v.date]));
      store.proposeAdoptionEdit(editing.id, {
        ...details,
        vaccinations: list(f.vaccines).map((name) => ({ name, date: old.get(name) ?? now.slice(0, 10) })),
        location: { ...editing.location, address: f.city.trim() },
      });
      toast.success(editing.status === "approved" ? t.post.sent : t.market.submitted);
      router.push("/account?tab=adoption");
      return;
    }
    store.addAdoption({
      id: `ad${Date.now()}`,
      ...details,
      vaccinations: list(f.vaccines).map((name) => ({ name, date: now.slice(0, 10) })),
      medicalHistory: [],
      shelter: { id: me.id, name: me.name },
      ownerId: me.id,
      location: { lat: here?.lat ?? 36.75, lng: here?.lng ?? 3.06, address: f.city.trim() },
      status: "pending",
      createdAt: now,
    });
    toast.success(t.market.submitted);
    router.push("/account?tab=adoption");
  };

  if (editId && !editing) return null;

  return (
    <div className="relative min-h-[100svh] overflow-clip">
      {/* phones: a focused full-screen flow like reporting (close + steps), no app bars */}
      <div className="hidden md:block">
        <TopNav noTabBar />
      </div>
      <Backdrop />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!canNext || checking) return;
          if (step < 3) go(step + 1);
          else submit();
        }}
        className="relative z-10 mx-auto max-w-[620px] px-4 pb-10 pt-[max(16px,env(safe-area-inset-top))] md:pb-36 md:pt-28"
      >
        <div className="mb-4 flex items-center justify-between sm:mb-6">
          <Link href={editing ? "/account?tab=adoption" : "/adopt"} className="glass flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90" aria-label={t.common.close}>
            <X className="h-5 w-5" />
          </Link>
          <Progress step={step} labels={t.post.steps} onJump={(n) => n < step && go(n)} />
          <span className="w-11" />
        </div>

        <div className="glass-strong relative overflow-hidden rounded-[32px] p-4 sm:rounded-[36px] sm:p-7">
          {editing && <div className="mb-3 inline-flex rounded-full bg-accent-soft px-3 py-1 text-[12.5px] font-semibold text-accent">{t.post.editTitle}</div>}
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ x: dir * 60, opacity: 0, filter: "blur(6px)" }}
              animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ x: dir * -60, opacity: 0, filter: "blur(6px)" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="space-y-3"
            >
              {step === 0 && (
                <>
                  <StepHeader emoji="/3d/camera.png" title={titles[0]} body={t.market.photosRule} />
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((p, i) => (
                      <motion.div key={p.slice(-24) + i} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative aspect-square overflow-hidden rounded-[18px]">
                        <Image src={p} alt="" fill unoptimized className="object-cover" />
                        <button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="glass absolute end-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full" aria-label={t.common.close}>
                          <X className="h-4 w-4" />
                        </button>
                      </motion.div>
                    ))}
                    {photos.length < 3 && (
                      <button type="button" onClick={() => fileRef.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[18px] border-2 border-dashed border-separator bg-surface/60 text-[13px] font-medium text-label-2 transition-transform active:scale-95">
                        {checking ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /> : <ImagePlus className="h-7 w-7" />}
                        {photos.length}/3
                      </button>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />
                  {/* Lets judges / testers on a computer try the flow. Every listing is still checked by an admin before it's public. */}
                  {photos.length === 0 && (
                    <div className="rounded-[18px] bg-surface-2/70 p-3.5">
                      <p className="text-[13px] leading-snug text-label-2">{t.market.demoPhotos}</p>
                      <div className="mt-2.5 flex gap-2">
                        {DEMO_PHOTOS.map((p) => (
                          <button key={p} type="button" onClick={() => setPhotos([p])} className="relative h-14 w-14 overflow-hidden rounded-[14px] transition-transform active:scale-95">
                            <Image src={p} alt="" fill sizes="56px" className="object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {step === 1 && (
                <>
                  <StepHeader emoji="/3d/paw.png" title={titles[1]} />
                  <div className="flex flex-wrap gap-1.5">
                    {SPECIES.map((sp) => (
                      <button key={sp} type="button" onClick={() => up("species", sp)} className={cn("flex h-10 items-center gap-1.5 rounded-full pe-3.5 ps-1.5 text-[14px] font-semibold transition-colors", f.species === sp ? "bg-accent-soft text-accent ring-2 ring-accent" : "bg-surface-2/70")}>
                        <Emoji3D src={SPECIES_EMOJI[sp]} size={24} /> {t.common.species[sp]}
                      </button>
                    ))}
                  </div>
                  <Segmented layoutId="sex-seg" className="w-full [&>button]:h-9 [&>button]:flex-1" value={f.sex} onChange={(v) => up("sex", v)} options={[{ value: "male", label: t.adopt.sex.male }, { value: "female", label: t.adopt.sex.female }]} />
                  <div className={group}>
                    <input value={f.name} onChange={(e) => up("name", e.target.value)} placeholder={t.market.name} className={field} enterKeyHint="next" />
                    <input type="number" inputMode="numeric" min={1} value={f.age} onChange={(e) => up("age", e.target.value)} placeholder={t.market.age} className={field} />
                    <input value={f.breed} onChange={(e) => up("breed", e.target.value)} placeholder={t.market.breed} className={field} />
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <StepHeader emoji="/3d/bandage.png" title={titles[2]} />
                  <div className={group}>
                    <input value={f.health} onChange={(e) => up("health", e.target.value)} placeholder={t.market.health} className={field} />
                    <input value={f.vaccines} onChange={(e) => up("vaccines", e.target.value)} placeholder={t.market.vaccines} className={field} />
                    <input value={f.behavior} onChange={(e) => up("behavior", e.target.value)} placeholder={t.market.behavior} className={field} />
                    <input value={f.care} onChange={(e) => up("care", e.target.value)} placeholder={t.market.care} className={field} />
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <StepHeader emoji="/3d/home.png" title={titles[3]} />
                  <div className={group}>
                    <textarea rows={4} value={f.story} onChange={(e) => up("story", e.target.value)} placeholder={t.market.story} className={cn(field, "h-auto resize-none py-3 leading-relaxed")} />
                  </div>
                  <div className={group}>
                    <input value={f.city} onChange={(e) => up("city", e.target.value)} placeholder={t.market.city} className={field} autoComplete="address-level2" />
                    <input type="tel" value={f.phone} onChange={(e) => up("phone", e.target.value)} placeholder={t.market.phone} className={field} dir="ltr" autoComplete="tel" />
                  </div>
                  <p className="text-[12.5px] leading-snug text-label-2">🛡️ {editing?.status === "approved" ? t.post.pendingBody : t.market.safety}</p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* stays under the thumb on phones */}
        <div className="sticky bottom-0 z-20 -mx-4 mt-5 flex gap-3 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 md:static md:mx-0 md:p-0">
          {step > 0 && (
            <Button type="button" variant="glass" size="lg" onClick={() => go(step - 1)} aria-label={t.common.back}>
              <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
            </Button>
          )}
          <Button type="submit" size="lg" className="flex-1" disabled={!canNext || checking}>
            {step < 3 ? t.common.next : editing ? t.post.send : t.market.submit}
          </Button>
        </div>
      </form>
    </div>
  );
}
