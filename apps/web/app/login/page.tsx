"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { AppIcon } from "@/components/brand/Logo";
import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/Button";
import { Emoji3D, Segmented } from "@/components/ui/primitives";
import { signIn, signUp, type SignUpRole } from "@/lib/auth";
import { inAlgeria } from "@/lib/trust";
import { useI18n } from "@/lib/i18n";
import { DEMO_PASSWORD, USERS } from "@/lib/mock/data";
import { SERVICE_EMOJI } from "@/lib/species";
import type { ServiceType } from "@/lib/types";
import { cn } from "@/lib/utils";

const input = "h-12 w-full rounded-[16px] bg-surface-2 px-4 text-[15px] outline-none ring-accent/40 placeholder:text-label-2 focus:ring-2";
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
  const next = params.get("next") ?? "/account";
  const [mode, setMode] = useState<"in" | "up">(params.get("mode") === "up" ? "up" : "in");
  const [f, setF] = useState({ email: "", password: "", name: "", phone: "", city: "", bizName: "" });
  const [role, setRole] = useState<SignUpRole>("reporter");
  const [bizType, setBizType] = useState<ServiceType>("shelter");
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<"choose" | "form">(params.get("mode") || params.get("next") ? "form" : "choose");
  const up = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "in") {
      const r = signIn(f.email, f.password);
      if (r === "invalid") return setError(t.account.invalid);
      toast.success(t.account.welcome(r.name));
      return router.push(next);
    }
    if (!otpStep) {
      // Sign-up is reserved for people in Algeria (backend re-checks with IP + GPS)
      const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);
      const pos = await new Promise<GeolocationPosition | null>((res) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 8000 }) : res(null));
      if (pos && !inAlgeria({ lat: pos.coords.latitude, lng: pos.coords.longitude })) return setError(t.geo.outside);
      if (!pos && !local) return setError(t.geo.denied);
      return setOtpStep(true); // real app: POST /auth/register → SMS code
    }
    const r = signUp({
      name: f.name,
      email: f.email,
      password: f.password,
      phone: f.phone,
      city: f.city,
      role,
      business: role === "pro" || role === "vet" ? { name: f.bizName || f.name, type: role === "vet" ? "vet" : bizType } : undefined,
    });
    if (r === "exists") {
      setOtpStep(false);
      return setError(t.account.exists);
    }
    toast.success(t.account.welcome(r.name));
    router.push(role === "pro" || role === "vet" ? "/account?tab=pro" : next);
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

  return (
    <div className="min-h-[100svh] pb-32">
      <TopNav />
      <div className="mx-auto flex max-w-[460px] flex-col items-center px-4 pt-28">
        <button type="button" onClick={() => setStep("choose")} className="mb-2 self-start text-[15px] font-semibold text-accent">‹ {t.common.back}</button>
        <AppIcon className="h-16 w-16" glow />
        <h1 className="mt-5 text-center text-[30px] font-extrabold">{t.auth.title}</h1>
        <p className="mt-1 text-center text-[15px] text-label-2">{t.account.needLoginBody}</p>

        <Segmented
          layoutId="auth-seg"
          className="mt-6 w-full [&>button]:flex-1"
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

        <form onSubmit={submit} className="glass-strong mt-4 w-full space-y-3 rounded-[30px] p-5">
          <AnimatePresence mode="wait" initial={false}>
            {mode === "up" && otpStep ? (
              <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-3 text-center">
                <Emoji3D src="/3d/phone.png" size={56} className="mx-auto" />
                <p className="text-[14px] text-label-2">{t.account.phoneNote}</p>
                <div className="text-[15px] font-semibold" dir="ltr">{f.phone}</div>
                <input autoFocus inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="• • • • • •" className={cn(input, "text-center text-[22px] tracking-[0.5em]")} dir="ltr" />
              </motion.div>
            ) : (
              <motion.div key={mode} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                {mode === "up" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {roles.map(([r, e, label]) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={cn("flex items-center gap-2 rounded-[18px] p-2.5 text-start text-[12.5px] font-semibold leading-tight transition-colors", role === r ? "bg-accent-soft text-accent ring-2 ring-accent" : "bg-surface-2")}
                        >
                          <Emoji3D src={e} size={30} className="shrink-0" />
                          {label}
                        </button>
                      ))}
                    </div>
                    {(role === "vet" || role === "pro") && (
                      <>
                        <input required value={f.bizName} onChange={(e) => up("bizName", e.target.value)} placeholder={t.biz.bizName} className={input} />
                        {role === "pro" && (
                          <div className="flex flex-wrap gap-1.5">
                            {BIZ_TYPES.map((ty) => (
                              <button key={ty} type="button" onClick={() => setBizType(ty)} className={cn("flex items-center gap-1.5 rounded-full py-1 pe-3 ps-1 text-[12.5px] font-semibold", bizType === ty ? "bg-accent-soft text-accent ring-2 ring-accent" : "bg-surface-2")}>
                                <Emoji3D src={SERVICE_EMOJI[ty]} size={22} /> {t.common.service[ty]}
                              </button>
                            ))}
                          </div>
                        )}
                        <p className="text-[12.5px] text-label-2">{role === "vet" ? t.account.vetNote : t.biz.pending}</p>
                      </>
                    )}
                    <input required value={f.name} onChange={(e) => up("name", e.target.value)} placeholder={t.account.name} className={input} autoComplete="name" />
                  </>
                )}
                <input required type="email" value={f.email} onChange={(e) => up("email", e.target.value)} placeholder={t.account.email} className={input} dir="ltr" autoComplete="email" />
                <input required type="password" minLength={mode === "up" ? 8 : 1} value={f.password} onChange={(e) => up("password", e.target.value)} placeholder={t.account.password} className={input} autoComplete={mode === "up" ? "new-password" : "current-password"} />
                {mode === "up" && (
                  <div className="grid grid-cols-2 gap-2">
                    <input required type="tel" value={f.phone} onChange={(e) => up("phone", e.target.value)} placeholder="+213 5XX XX XX XX" className={input} dir="ltr" autoComplete="tel" />
                    <input required value={f.city} onChange={(e) => up("city", e.target.value)} placeholder={t.acct.city} className={input} />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {error && <p className="text-[13.5px] font-medium text-urgent">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={mode === "up" && otpStep && otp.length < 6}>
            {mode === "in" ? t.account.signIn : otpStep ? t.common.next : t.account.signUp}
          </Button>
        </form>

        {/* Demo helper: only for the jury demo, remove once the real API is plugged in */}
        <div className="mt-6 w-full rounded-[22px] border border-dashed border-separator p-4">
          <div className="text-[12px] font-semibold text-label-2">
            {t.account.demo} <code className="rounded bg-surface-2 px-1.5 py-0.5">{DEMO_PASSWORD}</code>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {USERS.filter((u) => ["u1", "u2", "u3", "u9"].includes(u.id)).map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setMode("in");
                  setF((x) => ({ ...x, email: u.email!, password: DEMO_PASSWORD }));
                }}
                className="rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px] font-medium"
              >
                {u.name.replace(/^Dr\.\s*/, "Dr ").split(" ").slice(0, 2).join(" ")} · {t.dashboard.roles[u.role]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── Welcome: stickers orbiting the app icon (first screen, like a real iOS onboarding) ───────── */
const ORBIT = ["/3d/dog.png", "/3d/pin.png", "/3d/cat.png", "/3d/stethoscope.png", "/3d/sheep.png", "/3d/heart.png", "/3d/camel.png"];

function Welcome({ onEmail, onPhone }: { onEmail: () => void; onPhone: () => void }) {
  const { t } = useI18n();
  const social = "flex h-14 w-full items-center justify-center gap-3 rounded-full bg-white/80 text-[16px] font-semibold backdrop-blur transition-transform active:scale-[0.98] dark:bg-white/10";
  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-[linear-gradient(160deg,#cfe6ff_0%,#e6dcff_45%,#ffd9e8_100%)] dark:bg-[linear-gradient(160deg,#0b1830_0%,#1a1236_50%,#2a0f1f_100%)]">
      <TopNav />
      {/* phones: stacked · desktop: orbit on the left, buttons on the right (fits a laptop screen) */}
      <div className="mx-auto flex min-h-[100svh] max-w-[440px] flex-col items-center justify-center px-5 pb-28 pt-24 lg:max-w-[1040px] lg:flex-row lg:gap-16 lg:pb-10">
        <div className="relative h-[260px] w-[260px] shrink-0 sm:h-[300px] sm:w-[300px] lg:h-[400px] lg:w-[400px]">
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-white/70 dark:border-white/15" />
          <div className="absolute inset-[22%] rounded-full border-2 border-dashed border-white/60 dark:border-white/10" />
          <div className="absolute inset-[32%] rounded-full bg-white/40 blur-2xl dark:bg-white/5" />
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 14 }} className="absolute inset-0 flex items-center justify-center">
            <AppIcon className="h-20 w-20 sm:h-24 sm:w-24 lg:h-32 lg:w-32" glow />
          </motion.div>
          <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 60, repeat: Infinity, ease: "linear" }}>
            {ORBIT.map((src, i) => {
              const ang = (i / ORBIT.length) * Math.PI * 2 - Math.PI / 2;
              return (
                <motion.div
                  key={src}
                  className="absolute"
                  style={{ left: `calc(50% + ${Math.round(Math.cos(ang) * 47)}% - 28px)`, top: `calc(50% + ${Math.round(Math.sin(ang) * 47)}% - 28px)` }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: -360 }}
                  transition={{ scale: { type: "spring", delay: 0.2 + i * 0.07 }, rotate: { duration: 60, repeat: Infinity, ease: "linear" } }}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-white shadow-[0_10px_24px_-8px_rgba(60,40,120,0.35)] ring-4 ring-white lg:h-16 lg:w-16 dark:bg-white/10 dark:ring-white/10">
                    <Emoji3D src={src} size={38} />
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        <div className="w-full lg:max-w-[420px]">
          <h1 className="mt-8 text-center text-[30px] font-black leading-[1.05] sm:text-[36px] lg:mt-0 lg:text-start lg:text-[44px]">{t.login.hello}</h1>
          <p className="mt-2 text-center text-[15.5px] text-label-2 lg:text-start">{t.login.sub}</p>

          <div className="mt-7 w-full space-y-3">
            <button type="button" onClick={onEmail} className="h-14 w-full rounded-full bg-[#1d1d1f] text-[16px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)] transition-transform active:scale-[0.98] dark:bg-white dark:text-black">
              {t.login.email}
            </button>
            <button type="button" onClick={onPhone} className={social}>
              {t.login.phone}
            </button>
            <div className="flex items-center gap-3 py-1 text-[12px] uppercase tracking-widest text-label-2">
              <span className="h-px flex-1 bg-black/10 dark:bg-white/15" /> {t.login.or} <span className="h-px flex-1 bg-black/10 dark:bg-white/15" />
            </div>
            {/* Google / Facebook sign-in: wired by the backend (OAuth via Supabase Auth or NestJS Passport) */}
            <button type="button" onClick={() => toast(t.login.soon)} className={social}>
              <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden><path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.8Z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3a7.2 7.2 0 0 1-10.73-3.78h-4v3.1A12 12 0 0 0 12 24Z"/><path fill="#FBBC05" d="M5.33 14.31a7.2 7.2 0 0 1 0-4.62v-3.1h-4a12 12 0 0 0 0 10.82l4-3.1Z"/><path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.59 1.8l3.44-3.44A12 12 0 0 0 1.33 6.59l4 3.1A7.17 7.17 0 0 1 12 4.75Z"/></svg>
              {t.login.google}
            </button>
            <button type="button" onClick={() => toast(t.login.soon)} className={social}>
              <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden><path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"/></svg>
              {t.login.facebook}
            </button>
            <p className="pt-2 text-center text-[11.5px] text-label-2 lg:text-start">{t.login.terms}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
