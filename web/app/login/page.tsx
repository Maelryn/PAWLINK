"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { AppIcon } from "@/components/brand/Logo";
import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/Button";
import { Emoji3D, Segmented } from "@/components/ui/primitives";
import { signIn, signUp } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { DEMO_PASSWORD, USERS } from "@/lib/mock/data";
import { cn } from "@/lib/utils";

const input = "h-12 w-full rounded-[16px] bg-surface-2 px-4 text-[15px] outline-none ring-accent/40 placeholder:text-label-2 focus:ring-2";

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
  const next = useSearchParams().get("next") ?? "/map";
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"reporter" | "volunteer" | "vet">("reporter");
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");

  const done = (n: string) => {
    toast.success(t.account.welcome(n));
    router.push(next);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "in") {
      const r = signIn(email, password);
      if (r === "invalid") return setError(t.account.invalid);
      return done(r.name);
    }
    if (!otpStep) return setOtpStep(true); // real app: POST /auth/otp → SMS
    const r = signUp(name, email, role);
    if (r === "exists") return setError(t.account.exists);
    done(r.name);
  };

  return (
    <div className="min-h-[100svh] pb-32">
      <TopNav />
      <div className="mx-auto flex max-w-[440px] flex-col items-center px-4 pt-28">
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
                <div className="text-[15px] font-semibold" dir="ltr">{phone}</div>
                <input autoFocus inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="• • • • • •" className={cn(input, "text-center text-[22px] tracking-[0.5em]")} dir="ltr" />
              </motion.div>
            ) : (
              <motion.div key={mode} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                {mode === "up" && <input required value={name} onChange={(e) => setName(e.target.value)} placeholder={t.account.name} className={input} />}
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.account.email} className={input} dir="ltr" />
                {mode === "up" ? (
                  <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+213 5XX XX XX XX" className={input} dir="ltr" />
                ) : (
                  <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.account.password} className={input} />
                )}
                {mode === "up" && (
                  <>
                    <div className="pt-1 text-[13px] font-semibold text-label-2">{t.account.role}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        ["reporter", "/3d/camera.png"],
                        ["volunteer", "/3d/hearthands.png"],
                        ["vet", "/3d/stethoscope.png"],
                      ] as const).map(([r, e]) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={cn("flex flex-col items-center gap-1 rounded-[18px] p-2.5 text-[12px] font-semibold transition-colors", role === r ? "bg-accent-soft text-accent ring-2 ring-accent" : "bg-surface-2")}
                        >
                          <Emoji3D src={e} size={32} />
                          {t.account.roles[r]}
                        </button>
                      ))}
                    </div>
                    {role === "vet" && <p className="text-[12.5px] text-label-2">{t.account.vetNote}</p>}
                  </>
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
                  setEmail(u.email!);
                  setPassword(DEMO_PASSWORD);
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
