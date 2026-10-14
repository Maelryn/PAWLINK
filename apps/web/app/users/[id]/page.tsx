"use client";

import { motion } from "motion/react";
import { MapPin, Phone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { UserBadges } from "@/components/account/UserBadges";
import { CaseRow } from "@/components/cases/CaseBits";
import { TopNav } from "@/components/layout/TopNav";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar, Emoji3D } from "@/components/ui/primitives";
import { useSession } from "@/lib/auth";
import { activityOf, badgesOf } from "@/lib/badges";
import { useI18n } from "@/lib/i18n";
import { SERVICE_EMOJI } from "@/lib/species";
import { useStore } from "@/lib/store";

/** Public profile: who they are and what they did. No phone or e-mail (admins see the phone). */
export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const me = useSession();
  const u = useStore((s) => s.users).find((x) => x.id === id);
  const cases = useStore((s) => s.cases);
  const adoptions = useStore((s) => s.adoptions);
  const service = useStore((s) => s.services).find((x) => x.id === u?.serviceId && x.status === "approved");

  if (!u)
    return (
      <>
        <TopNav back={{ href: "/", label: t.common.back, history: true }} />
        <div className="flex min-h-[80svh] flex-col items-center justify-center gap-4 px-6 text-center text-label-2">
          <Emoji3D src="/3d/owl.png" size={90} />
          {t.profile.notFound}
        </div>
      </>
    );

  const { reported, helped, rehomed } = activityOf(u.id, cases, adoptions);
  const listings = adoptions.filter((a) => a.ownerId === u.id && (a.status === "approved" || a.status === "adopted"));
  const badges = badgesOf(u, cases, adoptions);
  const role = u.serviceId && u.role !== "vet" ? t.biz.signupAs.split(" (")[0] : t.dashboard.roles[u.role];

  return (
    <div className="min-h-[100svh] pb-32">
      <TopNav back={{ href: "/", label: t.common.back, history: true }} />
      <div className="mx-auto max-w-[720px] px-4 pt-[76px] sm:pt-24">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center text-center">
          <Avatar name={u.name} photo={u.photo} size={88} />
          <h1 className="mt-3 text-[28px] font-black leading-tight tracking-[-0.03em]">{u.name}</h1>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 text-[14px] text-label-2">
            <span className="font-semibold text-accent">{role}</span>
            {u.city && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {u.city}
              </span>
            )}
          </div>
          <UserBadges badges={badges} className="mt-3 justify-center" />
          {u.bio && <p className="mt-3 max-w-[460px] text-[15px] leading-relaxed text-label-2">{u.bio}</p>}
          {me?.role === "admin" && u.phone && (
            <a href={`tel:${u.phone.replace(/\s/g, "")}`} className="mt-4 flex h-11 items-center gap-2 rounded-full bg-accent px-4 text-[14px] font-semibold text-white" dir="ltr" title={t.profile.adminPhone}>
              <Phone className="h-4 w-4" /> {u.phone}
            </a>
          )}
        </motion.div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { e: "/3d/camera.png", n: reported.length, l: t.profile.reports },
            { e: "/3d/hearthands.png", n: helped.length, l: t.profile.helped },
            { e: "/3d/home.png", n: rehomed, l: t.profile.listings },
          ].map((s) => (
            <div key={s.l} className="card flex min-w-0 flex-col items-center gap-1.5 rounded-[24px] p-4 text-center">
              <Emoji3D src={s.e} size={32} />
              <div className="text-[24px] font-bold leading-none tabular-nums">{s.n}</div>
              <div className="text-[12px] leading-tight text-label-2">{s.l}</div>
            </div>
          ))}
        </div>

        {listings.length > 0 && (
          <section className="mt-4">
            <h2 className="px-1 pb-2 text-[19px] font-bold tracking-[-0.02em]">{t.profile.forAdoption}</h2>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {listings.map((a) => (
                <Link key={a.id} href={`/adopt/${a.id}`} className="group relative aspect-square overflow-hidden rounded-[18px] bg-surface-2">
                  <Image src={a.photos[0]} alt={a.name} fill unoptimized={a.photos[0].startsWith("data:")} sizes="(min-width:720px) 230px, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                  <span className="absolute inset-x-1.5 bottom-1.5 truncate rounded-full bg-black/45 px-2 py-0.5 text-center text-[11.5px] font-semibold text-white backdrop-blur">{a.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {service && (
          <Link href={`/services/${service.id}`} className="card mt-4 flex items-center gap-3 rounded-[24px] p-4 transition-transform active:scale-[0.98]">
            <Emoji3D src={SERVICE_EMOJI[service.type]} size={40} />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-label-2">{t.profile.business}</div>
              <div className="truncate font-bold">{service.name}</div>
            </div>
          </Link>
        )}

        {[
          { title: t.profile.helpedOn, list: helped },
          { title: t.profile.reported, list: reported },
        ].map((sec) => (
          <section key={sec.title} className="card mt-4 rounded-[28px] p-3">
            <h2 className="px-3 pb-1 pt-3 text-[19px] font-bold tracking-[-0.02em]">{sec.title}</h2>
            {sec.list.length === 0 && <p className="px-3 pb-3 text-[14px] text-label-2">{t.profile.nothing}</p>}
            {sec.list.slice(0, 6).map((c) => (
              <Link key={c.id} href={`/cases/${c.id}`}>
                <CaseRow c={c} />
              </Link>
            ))}
          </section>
        ))}
        {me?.id === u.id && (
          <ButtonLink href="/account?tab=profile" variant="tinted" className="mt-5 w-full">
            {t.acct.tabs.profile}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
