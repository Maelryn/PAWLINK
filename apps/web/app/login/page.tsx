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
  const up = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "in") {
      const r = signIn(f.email, f.password);
      if (r === "invalid") return setError(t.account.invalid);
      toast.success(t.account.welcome(r.name));
      return router.push(next);
    }
    if (!otpStep) return setOtpStep(true); // real app: POST /auth/register → SMS code
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

  return (
    <div className="min-h-[100svh] pb-32">
      <TopNav />
      <div className="mx-auto flex max-w-[460px] flex-col items-center px-4 pt-28">
        <AppIcon className="h-16 w-16" glow />
        <h1 className="mt-5 text-center text-[30px] font-bold tracking-[-0.03em]">{t.auth.title}</h1>
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
