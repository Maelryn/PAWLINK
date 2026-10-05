"use client";

import { useRouter } from "next/navigation";
import { Paywall } from "@/components/pro/Paywall";
import { ProShowcase } from "@/components/pro/ProShowcase";
import { Aurora } from "@/components/ui/Aurora";

/** /pro: phones = full-screen paywall; desktop = showcase + paywall in one big card, no scroll. */
export default function ProPage() {
  const router = useRouter();
  const close = () => (window.history.length > 1 ? router.back() : router.push("/"));
  return (
    <div className="relative flex h-[100svh] items-center justify-center overflow-hidden bg-bg md:p-6">
      <Aurora />
      <div className="relative flex h-full w-full overflow-hidden md:h-[min(760px,100%)] md:max-w-[1080px] md:rounded-[40px] md:shadow-[0_50px_120px_-40px_rgba(60,40,140,0.7)]">
        <ProShowcase />
        <div className="h-full w-full md:w-[430px] md:shrink-0">
          <Paywall onClose={close} />
        </div>
      </div>
    </div>
  );
}
