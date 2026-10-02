"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { can, useSession } from "@/lib/auth";

/** UI guard only. Real protection = JWT role checks in the NestJS API. Admin pages 404 for everyone else. */
export function RequireAuth({ area, children }: { area: "report" | "dashboard" | "admin"; children: React.ReactNode }) {
  const user = useSession();
  const router = useRouter();
  const path = usePathname();
  const ok = can(user, area);

  useEffect(() => {
    if (user === undefined || ok) return;
    if (area === "admin") router.replace("/not-found");
    else router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [user, ok, area, path, router]);

  if (!ok) return <div className="min-h-[100svh]" />;
  return <>{children}</>;
}
