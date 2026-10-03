import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "MALTown RiDE — Malamulele's local ride network",
};

const FEATURES = [
  {
    title: "Transparent fares",
    body: "Every quote is computed server-side from distance, time and class. No surge surprises, no client-side math.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
        <path d="M4 7h16M4 12h10M4 17h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Live tracking",
    body: "Watch your driver approach in real time with route lines, ETAs and instant status updates.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
        <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 2a8 8 0 0 1 8 8c0 5.25-8 12-8 12S4 15.25 4 10a8 8 0 0 1 8-8z" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    title: "Driver-first earnings",
    body: "Drivers see today, weekly and lifetime earnings with an 80% share on every completed trip.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
        <path d="M3 17l5-6 4 3 6-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 6h3v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Built for Vhembe",
    body: "Village landmarks, cash-first payments and lightweight maps for local trips around Malamulele.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
        <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
];

const STEPS = [
  { n: "01", title: "Pin your pickup", body: "Drop a pin or use your current location anywhere in the city." },
  { n: "02", title: "Pick your class", body: "RiDE Go, Comfort or Moto — each with an upfront, itemised fare." },
  { n: "03", title: "Track & go", body: "A nearby verified driver accepts, you track them live, and rate the trip after." },
];

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-night-950">
      {/* ambient backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-pulse-500/12 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[320px] w-[480px] rounded-full bg-nova-500/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.5) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <p className="font-display text-lg font-bold tracking-tight text-slate-100">
          MALTOWN <span className="text-pulse-400">RiDE</span>
        </p>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-slate-100">
            Sign in
          </Link>
          <Link href="/register" className="rounded-xl bg-pulse-500 px-4 py-2 text-sm font-bold text-night-950 shadow-[0_8px_24px_rgba(61,155,255,0.35)] hover:bg-pulse-400">
            Get started
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:pt-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-pulse-500/30 bg-pulse-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-pulse-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-go-400" /> Malamulele · Vhembe District
          </p>
          <h1 className="mt-5 font-display text-[clamp(2.4rem,6vw,4rem)] font-bold leading-[1.04] tracking-tight text-slate-50">
            Move with <span className="text-pulse-400">Africa&apos;s own</span> ride network.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400">
            MALTown RiDE connects Malamulele riders and verified local drivers with upfront fares, live tracking and
            earnings that respect the people behind the wheel. One tap, and your village comes closer.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/register?role=RIDER" className="rounded-xl bg-pulse-500 px-6 py-3.5 text-sm font-bold text-night-950 shadow-[0_12px_32px_rgba(61,155,255,0.4)] transition hover:bg-pulse-400">
              Request a ride
            </Link>
            <Link href="/register?role=DRIVER" className="rounded-xl border border-nova-500/50 bg-nova-500/10 px-6 py-3.5 text-sm font-bold text-nova-300 transition hover:bg-nova-500/20">
              Drive with us
            </Link>
          </div>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
            {[
              ["3", "vehicle classes"],
              ["24/7", "dispatch engine"],
              ["80%", "driver fare share"],
            ].map(([v, l]) => (
              <div key={l} className="glass-soft rounded-xl px-3 py-3 text-center">
                <dt className="sr-only">{l}</dt>
                <dd className="font-display text-xl font-bold text-pulse-400">{v}</dd>
                <dd className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Stylised route panel */}
        <div className="glass mt-float relative hidden rounded-3xl p-6 lg:block" aria-hidden>
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-bold text-slate-200">Trip preview</p>
            <span className="rounded-full border border-go-500/30 bg-go-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-go-400">
              Driver 3 min away
            </span>
          </div>
          <svg viewBox="0 0 320 220" className="mt-4 w-full">
            <defs>
              <linearGradient id="routeG" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#3D9BFF" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
            <g stroke="#1B2436" strokeWidth="1">
              {[40, 80, 120, 160, 200].map((y) => (
                <line key={y} x1="0" y1={y} x2="320" y2={y} />
              ))}
              {[60, 120, 180, 240, 300].map((x) => (
                <line key={x} x1={x} y1="0" x2={x} y2="220" />
              ))}
            </g>
            <path d="M30 190 C 90 150, 110 170, 150 120 S 240 70, 292 42" fill="none" stroke="url(#routeG)" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 9" />
            <circle cx="30" cy="190" r="7" fill="#0B1020" stroke="#34D399" strokeWidth="4" />
            <rect x="285" y="34" width="14" height="14" rx="3" fill="#A78BFA" transform="rotate(45 292 41)" />
            <circle cx="150" cy="120" r="12" fill="#0B1020" stroke="#5FB0FF" strokeWidth="2.5" />
            <path d="M150 113l4.5 9h-9z" fill="#5FB0FF" />
          </svg>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="glass-soft rounded-xl py-2.5">
              <p className="font-display text-sm font-bold text-slate-100">6.4 km</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">distance</p>
            </div>
            <div className="glass-soft rounded-xl py-2.5">
              <p className="font-display text-sm font-bold text-slate-100">R 70</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">upfront fare</p>
            </div>
            <div className="glass-soft rounded-xl py-2.5">
              <p className="font-display text-sm font-bold text-slate-100">14 min</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">ETA</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-16">
        <h2 className="font-display text-2xl font-bold text-slate-100">Engineered for the everyday commute</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <article key={f.title} className="glass rounded-2xl p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pulse-500/15 text-pulse-400">{f.icon}</div>
              <h3 className="mt-4 font-display text-base font-bold text-slate-100">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20">
        <div className="glass rounded-3xl p-8">
          <h2 className="font-display text-2xl font-bold text-slate-100">How a ride works</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <p className="font-display text-4xl font-bold text-pulse-500/30">{s.n}</p>
                <h3 className="mt-2 font-display text-base font-bold text-slate-100">{s.title}</h3>
                <p className="mt-1.5 text-sm text-slate-400">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/admin" className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10">
              Operations console →
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-xs text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} MALTown RiDE. Original platform — not affiliated with any other ride service.</p>
          <p>Malamulele · Xigalo · Ka-Mhinga</p>
        </div>
      </footer>
    </main>
  );
}
