"use client";

import { Hero } from "@/components/landing/Hero";
import { Bento, FinalCTA, Footer, MapReveal, StatsBand } from "@/components/landing/Sections";
import { TopNav } from "@/components/layout/TopNav";

export default function Home() {
  return (
    <>
      <TopNav />
      <main className="overflow-x-clip">
        <Hero />
        <MapReveal />
        <Bento />
        <StatsBand />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
