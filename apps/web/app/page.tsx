"use client";

import { Hero } from "@/components/landing/Hero";
import { Bento, FinalCTA, Footer, MapReveal, QuickActions } from "@/components/landing/Sections";
import { TopNav } from "@/components/layout/TopNav";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/auth";

export default function Home() {
  const user = useSession();
  const router = useRouter();
  // phones, signed in: opening PawLink lands on your Home, like an app (the landing page is for visitors)
  useEffect(() => {
    if (user && window.matchMedia("(max-width: 767px)").matches) router.replace("/account");
  }, [user, router]);
  return (
    <>
      <TopNav />
      <main className="overflow-x-clip">
        <Hero />
        <MapReveal />
        <Bento />
        <QuickActions />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
