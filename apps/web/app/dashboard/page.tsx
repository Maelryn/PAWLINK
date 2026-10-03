"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Kept for old links: the dashboard is now "My account". */
export default function DashboardRedirect() {
  const router = useRouter();
  useEffect(() => router.replace("/account"), [router]);
  return null;
}
