import React from "react";
import Link from "next/link";
import { ArrowUpRight, Aperture, Globe2, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { AsterialLogo, AsterialMark } from "@/components/brand/AsterialLogo";
import { ASTERIAL_BRAND } from "@/lib/constants/brand";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="asterial-auth grid min-h-dvh w-full bg-[#08090d] text-white lg:grid-cols-[1.04fr_.96fr]">
      <aside className="relative hidden min-h-dvh flex-col justify-between overflow-hidden border-r border-white/[0.07] bg-[#090b11] p-10 xl:p-14 lg:flex">
        <div className="asterial-auth-glow pointer-events-none absolute inset-0" />
        <div className="relative z-10">
          <Link href="/" className="inline-flex"><AsterialLogo showVersion size="md" /></Link>
        </div>

        <div className="relative z-10 my-12 max-w-[620px]">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-300" /> A calmer kind of connection
          </div>
          <h2 className="max-w-xl text-5xl font-semibold leading-[1.02] tracking-[-0.065em] text-white xl:text-6xl">
            Make room for <span className="asterial-gradient-text">your people.</span>
          </h2>
          <p className="mt-6 max-w-md text-sm leading-7 text-zinc-400">
            Conversations, communities and little everyday moments — brought together in one focused space.
          </p>

          <div className="mt-10 max-w-[520px] overflow-hidden rounded-[26px] border border-white/[0.10] bg-[#0d1017]/90 p-5 shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-200 to-indigo-300 text-sm font-bold text-[#0b0d13]">M</div>
                <div><p className="text-xs font-semibold">Maya Chen</p><p className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Online now</p></div>
              </div>
              <span className="text-[10px] text-zinc-600">DIRECT MESSAGE</span>
            </div>
            <div className="space-y-3 py-5">
              <div className="max-w-[78%] rounded-2xl rounded-bl-md border border-white/[0.06] bg-white/[0.04] px-4 py-3 text-xs leading-5 text-zinc-300">Hey, I found that little café you mentioned ☕</div>
              <div className="ml-auto max-w-[78%] rounded-2xl rounded-br-md bg-white px-4 py-3 text-xs leading-5 text-[#090a0e]">No way — send me the location!</div>
              <div className="max-w-[68%] rounded-2xl rounded-bl-md border border-white/[0.06] bg-white/[0.04] px-4 py-3 text-xs leading-5 text-zinc-300">Just sent it. We should go this weekend.</div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3"><span className="text-xs text-zinc-600">Write a message…</span><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-200 text-[#071019]"><ArrowUpRight className="h-4 w-4" /></span></div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] px-2.5 py-1.5 text-[10px] text-zinc-400"><MessageCircle className="h-3 w-3" /> Messages</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] px-2.5 py-1.5 text-[10px] text-zinc-400"><Globe2 className="h-3 w-3" /> Orbits</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] px-2.5 py-1.5 text-[10px] text-zinc-400"><Aperture className="h-3 w-3" /> Moments</span>
            </div>
          </div>

          <div className="mt-5 grid max-w-[520px] grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><ShieldCheck className="h-4 w-4 text-emerald-200" /><p className="mt-3 text-xs font-semibold">Thoughtful privacy</p><p className="mt-1 text-[10px] leading-4 text-zinc-500">Access rules built into the platform.</p></div>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><Sparkles className="h-4 w-4 text-sky-200" /><p className="mt-3 text-xs font-semibold">Less noise, more you</p><p className="mt-1 text-[10px] leading-4 text-zinc-500">A focused space for real conversations.</p></div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between gap-4 text-[10px] text-zinc-600">
          <span>{ASTERIAL_BRAND.name} · v{ASTERIAL_BRAND.version} · {ASTERIAL_BRAND.attribution}</span>
          <div className="flex gap-4"><Link href="/privacy" className="transition hover:text-zinc-300">Privacy</Link><Link href="/terms" className="transition hover:text-zinc-300">Terms</Link></div>
        </div>
      </aside>

      <main className="relative flex min-h-dvh flex-col justify-between overflow-hidden bg-[#0b0c11] px-5 py-6 sm:px-8 sm:py-8 lg:px-10 xl:px-14">
        <div className="asterial-auth-glow pointer-events-none absolute inset-0 opacity-50 lg:hidden" />
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="inline-flex lg:hidden"><AsterialLogo showVersion size="sm" /></Link>
          <span className="hidden text-[10px] uppercase tracking-[0.16em] text-zinc-600 lg:inline-flex">Your space is waiting</span>
          <Link href="/" className="ml-auto rounded-full border border-white/[0.08] px-3.5 py-2 text-[11px] text-zinc-400 transition hover:border-white/20 hover:text-white">Back to home</Link>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-[420px] py-10 sm:py-14">
          <div className="mb-7">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-200/15 bg-sky-200/[0.06] text-sky-100"><AsterialMark size={25} /></div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200">ASTERIAL ACCOUNT</p>
            <h1 className="text-3xl font-semibold tracking-[-0.055em] text-white sm:text-4xl">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{subtitle}</p>
          </div>
          <div className="rounded-[26px] border border-white/[0.09] bg-[#11131a]/90 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7">
            {children}
            {footer && <div className="mt-6 border-t border-white/[0.07] pt-5">{footer}</div>}
          </div>
          <p className="mt-5 text-center text-[10px] leading-5 text-zinc-600">By continuing, you agree to use ASTERIAL responsibly and respect other people in your space.</p>
        </div>

        <footer className="relative z-10 flex flex-wrap items-center justify-between gap-3 text-[10px] text-zinc-600">
          <span>Developer: {ASTERIAL_BRAND.developer}</span>
          <div className="flex gap-4 lg:hidden"><Link href="/privacy" className="hover:text-zinc-300">Privacy</Link><Link href="/terms" className="hover:text-zinc-300">Terms</Link></div>
        </footer>
      </main>
    </div>
  );
}
