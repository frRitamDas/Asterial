import React from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  Aperture,
  Check,
  ChevronRight,
  Globe2,
  LayoutList,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { AsterialLogo, AsterialMark } from "@/components/brand/AsterialLogo";
import { HomeSessionActions } from "@/components/brand/HomeSessionActions";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";

const features = [
  {
    number: "01",
    icon: MessageCircle,
    title: "Conversations that flow",
    description: "Fast direct messages and thoughtful group chats, with replies, reactions, edits and the little details that keep a conversation moving.",
    meta: "MESSAGES · GROUPS",
  },
  {
    number: "02",
    icon: Globe2,
    title: "Find your people",
    description: "Bring your communities into Orbits. Create spaces, organise topics and give every group the right tools and roles.",
    meta: "ORBITS · COMMUNITIES",
  },
  {
    number: "03",
    icon: Aperture,
    title: "Moments, while they last",
    description: "Share a small piece of your day with time-limited updates that disappear on schedule.",
    meta: "MOMENTS · 6–48 HOURS",
  },
  {
    number: "04",
    icon: LayoutList,
    title: "A feed in your own time",
    description: "A straightforward chronological feed for posts and conversations that matter to you, without algorithmic ranking.",
    meta: "FEED · CHRONOLOGICAL",
  },
];

export default function HomePage() {
  return (
    <div className="asterial-home min-h-dvh overflow-hidden bg-[#07080b] text-white">
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#07080b]/85 backdrop-blur-2xl">
        <div className="mx-auto flex h-[72px] max-w-[1320px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" aria-label="ASTERIAL home" className="shrink-0">
            <AsterialLogo size="sm" />
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
            <a href="#experience" className="text-[13px] text-zinc-400 transition-colors hover:text-white">Experience</a>
            <a href="#features" className="text-[13px] text-zinc-400 transition-colors hover:text-white">Features</a>
            <a href="#privacy" className="text-[13px] text-zinc-400 transition-colors hover:text-white">Privacy</a>
            <Link href="/welcome" className="text-[13px] text-zinc-400 transition-colors hover:text-white">Welcome</Link>
            <Link href="/download" className="text-[13px] text-zinc-400 transition-colors hover:text-white">Android app</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-full px-4 py-2.5 text-[13px] font-medium text-zinc-300 transition hover:bg-white/[0.06] hover:text-white sm:inline-flex">Sign in</Link>
            <Link href="/signup" className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[12px] font-semibold text-[#090a0d] transition hover:bg-zinc-200 sm:px-5">
              Get started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section id="experience" className="relative isolate">
          <div className="asterial-hero-glow pointer-events-none absolute inset-0 -z-10" />
          <div className="mx-auto grid min-h-[690px] max-w-[1320px] items-center gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pt-20 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10 lg:px-12 lg:pb-24 lg:pt-24">
            <div className="relative z-10 max-w-[610px]">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[11px] font-medium tracking-wide text-zinc-300 shadow-[0_0_35px_rgba(92,114,255,0.08)]">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-50" /><span className="relative inline-flex h-2 w-2 rounded-full bg-sky-300" /></span>
                A calmer space to stay connected
                <ChevronRight className="h-3 w-3 text-zinc-500" />
              </div>
              <h1 className="max-w-[650px] text-[clamp(3.2rem,7vw,6.4rem)] font-semibold leading-[0.94] tracking-[-0.075em] text-white">
                Make room for <span className="asterial-gradient-text">real connection.</span>
              </h1>
              <p className="mt-7 max-w-[480px] text-base leading-7 text-zinc-400 sm:text-[17px] sm:leading-8">
                Your conversations, communities and everyday moments — together in one beautifully focused place.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <HomeSessionActions />
                <Link href="/download" className="inline-flex h-12 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 text-[13px] font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.08]">
                  <Smartphone className="h-4 w-4" /> Explore Android
                </Link>
              </div>
              <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-sky-300" /> Web + native Android</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-sky-300" /> Private media access</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-sky-300" /> No ranked feed</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[650px] lg:ml-auto">
              <div className="absolute -inset-8 -z-10 rounded-[48px] bg-gradient-to-br from-indigo-500/20 via-sky-400/[0.08] to-transparent blur-3xl" />
              <div className="asterial-window overflow-hidden rounded-[28px] border border-white/[0.12] bg-[#0c0e14]/95 shadow-[0_35px_120px_rgba(0,0,0,0.55)]">
                <div className="flex h-14 items-center justify-between border-b border-white/[0.07] px-5 sm:px-6">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#ff6b68]" /><span className="h-2 w-2 rounded-full bg-[#f8c45a]" /><span className="h-2 w-2 rounded-full bg-[#54d59b]" />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.18em] text-zinc-500"><AsterialMark size={17} /> ASTERIAL SPACE</div>
                  <div className="h-6 w-6 rounded-full border border-white/10 bg-white/[0.05]" />
                </div>
                <div className="grid min-h-[420px] grid-cols-[54px_1fr] sm:grid-cols-[66px_1fr]">
                  <div className="flex flex-col items-center gap-5 border-r border-white/[0.06] bg-black/20 py-5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-black"><MessageCircle className="h-4 w-4" /></div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-600"><Users className="h-4 w-4" /></div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-600"><Aperture className="h-4 w-4" /></div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-600"><LayoutList className="h-4 w-4" /></div>
                    <div className="mt-auto h-8 w-8 rounded-full border border-white/10 bg-gradient-to-br from-sky-300 to-indigo-500" />
                  </div>
                  <div className="p-4 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300">Your space</p><h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Good to see you.</h2></div>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] text-zinc-400">Today</span>
                    </div>
                    <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-sky-300 text-sm font-bold text-[#0a0b10]">M</div>
                      <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-white">Maya Chen</p><p className="mt-1 truncate text-[11px] text-zinc-500">Sent you a message · 2 min ago</p></div>
                      <span className="h-2 w-2 rounded-full bg-sky-300" />
                    </div>
                    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/[0.06] p-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-300 to-orange-200 text-sm font-bold text-[#151015]">J</div>
                      <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-white">Jordan Lee</p><p className="mt-1 truncate text-[11px] text-zinc-500">That sounds perfect ✨</p></div>
                      <span className="text-[10px] text-zinc-600">9:41</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/[0.06] p-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300 to-teal-200 text-sm font-bold text-[#071410]">S</div>
                      <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-white">Sunday plans</p><p className="mt-1 truncate text-[11px] text-zinc-500">3 members · Group conversation</p></div>
                      <span className="rounded-full bg-sky-300 px-2 py-1 text-[9px] font-bold text-[#081019]">2</span>
                    </div>
                    <div className="mt-5 rounded-2xl border border-indigo-300/15 bg-gradient-to-br from-indigo-400/[0.12] via-sky-300/[0.05] to-transparent p-4">
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200"><Sparkles className="h-3.5 w-3.5" /> Little things, together</div>
                      <p className="mt-2 max-w-xs text-sm leading-6 text-zinc-300">Share a Moment, check in with your people, or start something new.</p>
                      <div className="mt-4 flex items-center gap-2 text-[11px] font-medium text-white">Explore your space <ArrowDownRight className="h-3.5 w-3.5" /></div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-white/[0.07] px-5 py-3 text-[10px] text-zinc-600"><span>Designed for your everyday</span><span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Connected</span></div>
              </div>
              <div className="absolute -bottom-5 -left-3 hidden rounded-2xl border border-white/10 bg-[#13151c]/95 px-4 py-3 shadow-xl backdrop-blur-xl sm:block">
                <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-300/10 text-sky-200"><Zap className="h-4 w-4" /></div><div><p className="text-xs font-semibold text-white">A little less noise</p><p className="mt-1 text-[10px] text-zinc-500">More room for what matters</p></div></div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.07] bg-white/[0.018]">
          <div className="mx-auto grid max-w-[1320px] gap-6 px-5 py-7 sm:grid-cols-3 sm:px-8 lg:px-12">
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]"><MessageCircle className="h-4 w-4 text-sky-200" /></div><div><p className="text-sm font-medium">A place for your people</p><p className="mt-1 text-xs text-zinc-500">One-to-one and group chats</p></div></div>
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]"><Sparkles className="h-4 w-4 text-indigo-200" /></div><div><p className="text-sm font-medium">Small moments matter</p><p className="mt-1 text-xs text-zinc-500">Share updates that fade away</p></div></div>
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]"><ShieldCheck className="h-4 w-4 text-emerald-200" /></div><div><p className="text-sm font-medium">Privacy with intention</p><p className="mt-1 text-xs text-zinc-500">Access rules enforced by the backend</p></div></div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-[1320px] px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl"><p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300">Made for everyday connection</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">Everything fits.<br /><span className="text-zinc-500">Nothing gets in the way.</span></h2></div>
            <p className="max-w-sm text-sm leading-6 text-zinc-400">Thoughtful tools for conversations, communities and sharing — all connected through one consistent experience.</p>
          </div>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.number} className="asterial-feature-card group relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-6 transition duration-300 hover:-translate-y-1 hover:border-sky-200/25 hover:bg-white/[0.045]">
                  <div className="flex items-center justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-200/10 bg-sky-200/[0.06] text-sky-100"><Icon className="h-5 w-5" /></div><span className="font-mono text-[10px] text-zinc-600">{feature.number}</span></div>
                  <p className="mt-8 text-[9px] font-semibold tracking-[0.16em] text-zinc-500">{feature.meta}</p>
                  <h3 className="mt-3 text-lg font-semibold tracking-tight">{feature.title}</h3>
                  <p className="mt-3 min-h-[104px] text-[13px] leading-6 text-zinc-400">{feature.description}</p>
                  <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4 text-xs text-zinc-300"><span>Discover feature</span><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="privacy" className="px-5 pb-24 sm:px-8 sm:pb-32 lg:px-12">
          <div className="relative mx-auto max-w-[1320px] overflow-hidden rounded-[32px] border border-white/[0.09] bg-[#0d1017] px-6 py-10 sm:px-10 sm:py-14 lg:px-16">
            <div className="pointer-events-none absolute -right-24 -top-40 h-96 w-96 rounded-full bg-sky-400/[0.10] blur-[100px]" />
            <div className="relative grid gap-10 md:grid-cols-[1fr_auto] md:items-center">
              <div className="max-w-2xl"><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.06] text-emerald-200"><ShieldCheck className="h-5 w-5" /></div><h2 className="mt-6 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Privacy should be part of the design.</h2><p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400">ASTERIAL uses server-enforced access policies and private media delivery to help keep conversations and uploads within their intended audience. No claim of end-to-end encryption is made.</p><Link href="/privacy" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-sky-200 transition hover:text-white">Read our privacy approach <ArrowRight className="h-4 w-4" /></Link></div>
              <div className="grid grid-cols-2 gap-3 md:w-[300px]"><div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4"><ShieldCheck className="h-4 w-4 text-emerald-200" /><p className="mt-5 text-sm font-semibold">Access control</p><p className="mt-1 text-xs leading-5 text-zinc-500">Rules enforced by PostgreSQL</p></div><div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4"><Zap className="h-4 w-4 text-sky-200" /><p className="mt-5 text-sm font-semibold">Private media</p><p className="mt-1 text-xs leading-5 text-zinc-500">Short-lived signed access</p></div></div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1320px] px-5 pb-24 sm:px-8 lg:px-12">
          <div className="relative overflow-hidden rounded-[32px] bg-white px-6 py-10 text-[#08090c] sm:px-10 sm:py-14 lg:px-16">
            <div className="absolute -right-10 -top-24 h-72 w-72 rounded-full border-[48px] border-black/[0.04]" /><div className="absolute -right-2 -top-16 h-52 w-52 rounded-full border border-black/[0.06]" />
            <div className="relative max-w-2xl"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Your next conversation starts here</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.06em] sm:text-5xl">Come as you are.<br />Stay connected.</h2><p className="mt-4 max-w-lg text-sm leading-6 text-zinc-600">Create your ASTERIAL account and bring your conversations into one clear, considered space.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/signup" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#08090c] px-5 text-xs font-semibold text-white transition hover:bg-zinc-800">Create your account <ArrowRight className="h-4 w-4" /></Link><Link href="/login" className="inline-flex h-11 items-center rounded-full border border-black/10 px-5 text-xs font-semibold transition hover:bg-black/[0.04]">I already have an account</Link></div></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-8 px-5 py-9 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <div><Link href="/" className="inline-flex"><AsterialLogo size="sm" /></Link><p className="mt-3 text-xs text-zinc-600">Thoughtful communication, by design.</p><p className="mt-1 text-[10px] text-zinc-700">Developer: {ASTERIAL_BRAND.developer} · {ASTERIAL_BRAND.attribution} · v{ASTERIAL_BRAND.version}</p></div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-zinc-500"><Link href="/download" className="transition hover:text-white">Android</Link><Link href="/privacy" className="transition hover:text-white">Privacy</Link><Link href="/terms" className="transition hover:text-white">Terms</Link><Link href="/login" className="transition hover:text-white">Sign in</Link></div>
        </div>
      </footer>
    </div>
  );
}
