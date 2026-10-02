"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/auth";

/** Browsing is open to everyone; these pages are actions and need an account. (The API enforces it too.) */
const PROTECTED = ["/report", "/dashboard", "/admin", "/adopt/new"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const user = useSession();
  const path = usePathname();
  const router = useRouter();
  const locked = PROTECTED.some((p) => path.startsWith(p));

  useEffect(() => {
    if (locked && user === null) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [locked, user, path, router]);

  if (locked && !user) return <div className="min-h-[100svh]" />;
  return <>{children}</>;
}
