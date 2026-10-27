"use client";

import { getPosition } from "@/lib/geo";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { wakeApi } from "@/lib/api/client";
import { toast } from "sonner";
import { AppIcon } from "@/components/brand/Logo";
import { Aurora } from "@/components/ui/Aurora";
import { ChevronLeft } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/Button";
import { Emoji3D, Segmented } from "@/components/ui/primitives";
import { finishSignUp, resendCode, signIn, startSignUp, type SignUpInput, type SignUpRole } from "@/lib/auth";
import { inAlgeria } from "@/lib/trust";
import { useI18n } from "@/lib/i18n";
import { DEMO_PASSWORD, USERS } from "@/lib/mock/data";
import { SERVICE_EMOJI } from "@/lib/species";
import type { ServiceType } from "@/lib/types";
import { cn } from "@/lib/utils";

const BIZ_TYPES: ServiceType[] = ["shelter", "transport", "boarding", "training", "store"];

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  // only ever redirect inside PawLink (no open redirect to another site)
  const rawNext = params.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\") ? rawNext : "/account"; // signed in → straight to Home
  const [mode, setMode] = useState<"in" | "up">(params.get("mode") === "up" ? "up" : "in");
  const [f, setF] = useState({ email: "", password: "", name: "", phone: "", city: "", bizName: "" });
  const [role, setRole] = useState<SignUpRole>("reporter");
  const [bizType, setBizType] = useState<ServiceType>("shelter");
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // still waiting after 8 s: the free API server is waking up, say so instead of spinning silently
  const [slow, setSlow] = useState(false);
  useEffect(() => wakeApi(), []);
  /** SMS code returned by the API outside production (console SMS provider), shown so testers can sign up */
  const [devCode, setDevCode] = useState<string | null>(null);
  const errText = (code: string, message?: string) => t.auth.errors[code] ?? (code === "RATE_LIMITED" ? t.auth.errors.TOO_MANY : message || t.auth.errors.UNKNOWN);
  const [step, setStep] = useState<"choose" | "form">(params.get("mode") || params.get("next") ? "form" : "choose");
  const up = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const signUpInput = (): SignUpInput => ({
    name: f.name,
    email: f.email,
    password: f.password,
    phone: f.phone,
    city: f.city,
    role,
    business: role === "pro" || role === "vet" ? { name: f.bizName || f.name, type: role === "vet" ? "vet" : bizType } : undefined,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    const late = setTimeout(() => setSlow(true), 8000);
    try {
      if (mode === "in") {
        const r = await signIn(f.email, f.password);
        if ("error" in r) return setError(errText(r.error, r.message));
        toast.success(t.account.welcome(r.user.name));
        return router.push(next);
      }
      if (!otpStep) {
        // PawLink is for Algeria: a position clearly outside it is refused (the backend re-checks).
        // No position (refused / unavailable) doesn't block sign-up: reporting itself checks it.
        const pos = await getPosition(6000);
        if (pos && !inAlgeria(pos)) return setError(t.geo.outside);
        const r = await startSignUp(signUpInput()); // POST /auth/register → SMS code
        if ("error" in r) return setError(errText(r.error, r.message));
        setDevCode(r.sent.code ?? null);
        if (r.sent.expiresAt) toast(t.auth.codeSent(r.sent.phone));
        return setOtpStep(true);
      }
      const r = await finishSignUp(signUpInput(), otp); // POST /auth/verify-phone
      if ("error" in r) return setError(errText(r.error, r.message));
      toast.success(t.account.welcome(r.user.name));
      router.push(role === "pro" || role === "vet" ? "/account?tab=pro" : next);
    } finally {
      clearTimeout(late);
      setSlow(false);
      setBusy(false);
    }
  };

  const resend = async () => {
    const r = await resendCode(f.phone);
    if ("error" in r) return setError(errText(r.error, r.message));
    setDevCode(r.sent.code ?? null);
    setOtp("");
    toast(t.auth.resent);
  };

  const roles: [SignUpRole, string, string][] = [
    ["reporter", "/3d/camera.png", t.account.roles.reporter],
    ["volunteer", "/3d/hearthands.png", t.account.roles.volunteer],
    ["vet", "/3d/stethoscope.png", t.account.roles.vet],
    ["pro", "/3d/home.png", t.biz.signupAs],
  ];

  if (step === "choose")
    return (
      <Welcome
        onEmail={() => setStep("form")}
        onPhone={() => {
          setMode("up");
          setStep("form");
        }}
      />
    );

  const field = "h-[50px] w-full bg-transparent px-4 text-[17px] outline-none placeholder:text-label-3 sm:h-12 sm:text-[16px]";
  const group = "overflow-hidden rounded-[18px] bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)] divide-y divide-separator dark:shadow-none";
  const shortRole: Record<SignUpRole, string> = { reporter: t.dashboard.roles.reporter, volunteer: t.dashboard.roles.volunteer, vet: t.dashboard.roles.vet, pro: t.pay.tiers.pro };

  return (
    <div className="relative h-[100svh] overflow-y-auto overflow-x-clip bg-bg">
      <Aurora />
      <div className="hidden lg:block">
        <TopNav noTabBar />
      </div>
      {/* phones: iOS back button floating top-left */}
      <button type="button" onClick={() => setStep("choose")} className="glass fixed start-4 top-[max(12px,env(safe-area-inset-top))] z-30 flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90 lg:hidden" aria-label={t.common.back}>
        <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
      </button>
      <div className="relative mx-auto flex min-h-full max-w-[1080px] flex-col items-center justify-center px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(64px,env(safe-area-inset-top))] lg:flex-row lg:gap-16 lg:pb-4 lg:pt-16">
        <div className="relative hidden h-[440px] w-[440px] shrink-0 lg:block">
          <PhotoStack />
        </div>
        <div className="flex w-full max-w-[400px] shrink-0 flex-col">
          {/* centered iOS header */}
          <div className="flex flex-col items-center text-center">
            <button type="button" onClick={() => setStep("choose")} className="mb-4 hidden h-10 items-center gap-1 self-start rounded-full pe-4 ps-2 text-[15px] font-semibold text-accent transition-opacity hover:opacity-70 lg:flex" aria-label={t.common.back}>
              <ChevronLeft className="h-5 w-5 rtl:rotate-180" /> {t.common.back}
            </button>
            <AppIcon className={cn("h-14 w-14 rounded-[16px] shadow-[0_10px_24px_-10px_rgba(10,124,255,0.6)]", mode === "up" && "lg:hidden")} />
            <h1 className="mt-3 text-[30px] font-black leading-tight tracking-[-0.03em]">{mode === "in" ? t.account.signIn : t.account.signUp}</h1>
            {mode === "in" && <p className="mt-1 max-w-[300px] text-[15px] leading-snug text-label-2">{t.auth.subtitle}</p>}
          </div>

          <Segmented
            layoutId="auth-seg"
            className="mt-5 w-full [&>button]:h-9 [&>button]:flex-1 [&>button]:text-[15px]"
            value={mode}
            onChange={(m) => {
              setMode(m);
              setOtpStep(false);
              setError("");
            }}
            options={[
              { value: "in", label: t.account.signIn },
              { value: "up", label: t.account.signUp },
            ]}
          />

          <form onSubmit={submit} className="mt-4 w-full space-y-3">
            <AnimatePresence mode="wait" initial={false}>
              {mode === "up" && otpStep ? (
                <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-3 py-2 text-center">
                  <Emoji3D src="/3d/phone.png" size={52} className="mx-auto" />
                  <p className="text-[13.5px] text-label-2">{t.account.phoneNote}</p>
                  <div className="text-[15px] font-semibold" dir="ltr">{f.phone}</div>
                  <input autoFocus inputMode="numeric" autoComplete="one-time-code" enterKeyHint="done" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="• • • • • •" className={cn(field, "h-14 rounded-[18px] bg-surface text-center text-[24px] tracking-[0.5em]")} dir="ltr" />
                  {devCode && (
                    <button type="button" onClick={() => setOtp(devCode)} className="mx-auto block rounded-full bg-accent-soft px-3 py-1.5 text-[12.5px] font-semibold text-accent" dir="ltr">
                      {t.auth.devCode(devCode)}
                    </button>
                  )}
                  <button type="button" onClick={resend} className="mx-auto block py-1 text-[13px] font-semibold text-accent">
                    {t.auth.resend}
                  </button>
                </motion.div>
              ) : (
                <motion.div key={mode} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-2.5">
                  {mode === "up" && (
                    <>
                      <div className="grid grid-cols-4 gap-1.5">
                        {roles.map(([r, e]) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setRole(r)}
                            className={cn("flex flex-col items-center gap-1 rounded-[16px] px-1 py-2.5 text-[12px] font-semibold leading-tight transition-colors", role === r ? "bg-accent-soft text-accent ring-2 ring-accent" : "bg-surface")}
                          >
                            <Emoji3D src={e} size={26} />
                            <span className="max-w-full truncate">{shortRole[r]}</span>
                          </button>
                        ))}
                      </div>
                      {(role === "vet" || role === "pro") && (
                        <>
                          <div className={group}><input required value={f.bizName} onChange={(e) => up("bizName", e.target.value)} placeholder={t.biz.bizName} className={field} /></div>
                          {role === "pro" && (
                            <div className="scroll-fade -mx-1 flex gap-1.5 overflow-x-auto px-1 no-scrollbar">
                              {BIZ_TYPES.map((ty) => (
                                <button key={ty} type="button" onClick={() => setBizType(ty)} className={cn("flex shrink-0 items-center gap-1 rounded-full py-1 pe-2.5 ps-1 text-[12px] font-semibold", bizType === ty ? "bg-accent-soft text-accent ring-2 ring-accent" : "bg-surface")}>
                                  <Emoji3D src={SERVICE_EMOJI[ty]} size={20} /> {t.common.service[ty]}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                  <div className={group}>
                    {mode === "up" && <input required value={f.name} onChange={(e) => up("name", e.target.value)} placeholder={t.account.name} className={field} autoComplete="name" />}
                    <input required type="email" value={f.email} onChange={(e) => up("email", e.target.value)} placeholder={t.account.email} className={field} dir="ltr" autoComplete="email" autoCapitalize="none" autoCorrect="off" enterKeyHint="next" />
                    <input required type="password" minLength={mode === "up" ? 8 : 1} value={f.password} onChange={(e) => up("password", e.target.value)} placeholder={t.account.password} className={field} autoComplete={mode === "up" ? "new-password" : "current-password"} enterKeyHint={mode === "in" ? "go" : "next"} />
                    {mode === "up" && <input required type="tel" value={f.phone} onChange={(e) => up("phone", e.target.value)} placeholder="+213 5XX XX XX XX" className={field} dir="ltr" autoComplete="tel" />}
                    {mode === "up" && <input required value={f.city} onChange={(e) => up("city", e.target.value)} placeholder={t.acct.city} className={field} autoComplete="address-level2" />}
                  </div>
                  {mode === "up" && (role === "vet" || role === "pro") && <p className="text-[11.5px] leading-snug text-label-2">{role === "vet" ? t.account.vetNote : t.biz.pending}</p>}
                </motion.div>
              )}
            </AnimatePresence>
            {error && <p className="text-[13px] font-medium text-urgent">{error}</p>}
            <Button type="submit" className="h-[52px] w-full text-[17px]" disabled={busy || (mode === "up" && otpStep && otp.length < 6)}>
              {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />}
              {mode === "in" ? t.account.signIn : otpStep ? t.common.next : t.account.signUp}
            </Button>
            {busy && slow && <p className="text-center text-[13px] text-label-2">{t.report.slowServer}</p>}
          </form>

          {/* Demo helper (jury demo only, remove once the real API is plugged in) */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 lg:justify-start">
            <span className="w-full text-center text-[11.5px] font-semibold text-label-2 lg:w-auto lg:text-start">{t.account.demo} <code className="rounded bg-surface-2 px-1">{DEMO_PASSWORD}</code></span>
            {USERS.filter((u) => ["u1", "u2", "u3", "u9"].includes(u.id)).map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setMode("in");
                  setF((x) => ({ ...x, email: u.email!, password: DEMO_PASSWORD }));
                }}
                className="h-8 shrink-0 rounded-full bg-surface px-3 text-[12px] font-medium shadow-sm transition-transform active:scale-95"
              >
                {u.name.replace(/^Dr\.\s*/, "Dr ").split(" ")[0] === "Dr" ? u.name.replace(/^Dr\.\s*/, "Dr ").split(" ").slice(0, 2).join(" ") : u.name.split(" ")[0]} · {t.dashboard.roles[u.role]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── Welcome: stickers orbiting the app icon (first screen, like a real iOS onboarding) ───────── */

/* Welcome: a stack of real rescued-animal photos (like a photo collection) + stickers, fits one screen */
const STACK = [
  { src: "/mock/cat-kitten.jpg", rot: -9, x: "-23%", y: "6%", z: 1, d: 0.15 },
  { src: "/mock/dog-puppy.jpg", rot: 8, x: "23%", y: "2%", z: 2, d: 0.25 },
  { src: "/mock/dog-beagle.jpg", rot: -2, x: "0%", y: "-4%", z: 3, d: 0.35 },
];
const STICKERS = [
  { src: "/3d/heart.png", x: "4%", y: "0%", s: 46, r: -14 },
  { src: "/3d/paw.png", x: "84%", y: "74%", s: 44, r: 12 },
  { src: "/3d/sparkles.png", x: "88%", y: "-4%", s: 38, r: 0 },
  { src: "/3d/pin.png", x: "-2%", y: "72%", s: 42, r: -8 },
];

function Welcome({ onEmail, onPhone }: { onEmail: () => void; onPhone: () => void }) {
  const { t } = useI18n();
  const social = "flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-white/85 text-[15px] font-semibold backdrop-blur transition-transform active:scale-[0.98] sm:h-[52px] dark:bg-white/10";
  return (
    <div className="relative h-[100svh] overflow-hidden bg-[linear-gradient(165deg,#d8ebff_0%,#ece3ff_50%,#ffe1ec_100%)] dark:bg-[linear-gradient(165deg,#0b1830_0%,#1a1236_50%,#2a0f1f_100%)]">
      <Aurora intensity={0.8} />
      <TopNav noTabBar />
      {/* phones: a way back to the home page (the top bar only has settings here) */}
      <Link href="/" className="glass fixed start-4 top-[max(12px,env(safe-area-inset-top))] z-[60] flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90 md:hidden" aria-label={t.common.back}>
        <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
      </Link>
      <div className="relative mx-auto flex h-full max-w-[440px] flex-col justify-end px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-20 lg:max-w-[1080px] lg:flex-row lg:items-center lg:justify-center lg:gap-20 lg:pb-8">
        {/* photo stack */}
        <div className="relative mx-auto w-full max-w-[340px] flex-1 lg:max-w-[460px] lg:flex-none lg:basis-[460px] lg:self-stretch">
          <div className="absolute inset-x-0 top-1/2 h-[min(100%,330px)] -translate-y-1/2 lg:h-[440px]">
            <PhotoStack />
          </div>
        </div>

        <div className="w-full shrink-0 lg:max-w-[400px]">
          <div className="flex items-center justify-center gap-2 lg:justify-start">
            <AppIcon className="h-9 w-9" />
            <span className="bg-gradient-to-r from-[#1f8bff] to-[#7b4dff] bg-clip-text font-display text-[22px] font-black text-transparent">pawlink</span>
          </div>
          <h1 className="mt-3 text-center text-[28px] font-black leading-[1.05] sm:text-[32px] lg:text-start lg:text-[44px]">{t.login.hello}</h1>
          <p className="mx-auto mt-2 max-w-[360px] text-center text-[14.5px] leading-snug text-label-2 lg:mx-0 lg:text-start lg:text-[15.5px]">{t.login.sub}</p>

          <div className="mt-5 w-full space-y-2.5">
            <button type="button" onClick={onEmail} className="h-12 w-full rounded-full bg-[#1d1d1f] text-[15.5px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)] transition-transform active:scale-[0.98] sm:h-[52px] dark:bg-white dark:text-black">
              {t.login.email}
            </button>
            <button type="button" onClick={onPhone} className={social}>
              {t.login.phone}
            </button>
            <div className="flex items-center gap-3 text-[11.5px] uppercase tracking-widest text-label-2">
              <span className="h-px flex-1 bg-black/10 dark:bg-white/15" /> {t.login.or} <span className="h-px flex-1 bg-black/10 dark:bg-white/15" />
            </div>
            {/* Google / Facebook sign-in: wired by the backend (OAuth via Supabase Auth) */}
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => toast(t.login.soon)} className={social} aria-label={t.login.google}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.8Z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3a7.2 7.2 0 0 1-10.73-3.78h-4v3.1A12 12 0 0 0 12 24Z"/><path fill="#FBBC05" d="M5.33 14.31a7.2 7.2 0 0 1 0-4.62v-3.1h-4a12 12 0 0 0 0 10.82l4-3.1Z"/><path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.59 1.8l3.44-3.44A12 12 0 0 0 1.33 6.59l4 3.1A7.17 7.17 0 0 1 12 4.75Z"/></svg>
                Google
              </button>
              <button type="button" onClick={() => toast(t.login.soon)} className={social} aria-label={t.login.facebook}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"/></svg>
                Facebook
              </button>
            </div>
            <p className="text-center text-[11px] leading-snug text-label-2 lg:text-start">{t.login.terms}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tilted stack of real rescued-animal photos + floating 3D stickers. Fills its parent. */
function PhotoStack() {
  return (
    <div className="absolute inset-0">
            {STACK.map((p) => (
              <div key={p.src} className="absolute aspect-[3/4] h-[76%] -translate-x-1/2 -translate-y-1/2" style={{ left: `calc(50% + ${p.x})`, top: `calc(50% + ${p.y})`, zIndex: p.z }}>
                <motion.div
                  className="relative h-full w-full overflow-hidden rounded-[26px] border-[5px] border-white bg-surface shadow-[0_24px_48px_-20px_rgba(40,30,90,0.45)] dark:border-white/15"
                  initial={{ opacity: 0, y: 80, rotate: 0 }}
                  animate={{ opacity: 1, y: [0, -8, 0], rotate: p.rot }}
                  transition={{ opacity: { delay: p.d }, rotate: { type: "spring", stiffness: 120, damping: 14, delay: p.d }, y: { duration: 5 + p.z, repeat: Infinity, ease: "easeInOut", delay: 1 + p.d } }}
                  whileHover={{ scale: 1.04, rotate: 0 }}
                >
                  <Image src={p.src} alt="" fill sizes="260px" priority className="object-cover" />
                </motion.div>
              </div>
            ))}
            {STICKERS.map((st, i) => (
              <motion.div
                key={st.src}
                className="absolute z-10"
                style={{ left: st.x, top: st.y }}
                initial={{ scale: 0, rotate: st.r - 30 }}
                animate={{ scale: 1, rotate: st.r, y: [0, -6, 0] }}
                transition={{ scale: { type: "spring", stiffness: 260, damping: 12, delay: 0.6 + i * 0.1 }, rotate: { type: "spring", delay: 0.6 + i * 0.1 }, y: { duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut" } }}
              >
                <Emoji3D src={st.src} size={st.s} className="drop-shadow-[0_8px_12px_rgba(0,0,0,0.18)]" />
              </motion.div>
            ))}
    </div>
  );
}
