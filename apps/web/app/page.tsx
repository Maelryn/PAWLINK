"use client";

import { Hero } from "@/components/landing/Hero";
import { Bento, FinalCTA, Footer, MapReveal, QuickActions } from "@/components/landing/Sections";
import { TopNav } from "@/components/layout/TopNav";

export default function Home() {
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
