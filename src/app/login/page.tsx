"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, GlassCard, toast, Toaster } from "@/components/ui";
import { roleHome } from "@/hooks/useUser";
import { api } from "@/lib/api-client";
import type { UserDto } from "@/lib/types";

const DEMO_ACCOUNTS = [
  { label: "Rider demo", email: "rider@maltown.dev", password: "Rider123!" },
  { label: "Driver demo", email: "driver1@maltown.dev", password: "Driver123!" },
  { label: "Admin demo", email: "admin@maltown.dev", password: "Admin123!" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: FormEvent, creds?: { email: string; password: string }) {
    e?.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = creds ?? { email, password };
      const data = await api<{ user: UserDto }>("/auth/login", { body });
      toast(`Welcome back, ${data.user.name.split(" ")[0]}`, "success");
      router.push(roleHome(data.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-night-950 px-4 py-10">
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute -top-32 left-1/2 h-[420px] w-[640px] -translate-x-1/2 rounded-full bg-pulse-500/10 blur-[130px]" />
      </div>
      <Toaster />
      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-6 block text-center font-display text-xl font-bold text-slate-100">
          MALTOWN <span className="text-pulse-400">RiDE</span>
        </Link>
        <GlassCard className="mt-slide-up p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold text-slate-50">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to keep moving.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <Field
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            {error ? (
              <p role="alert" className="rounded-lg border border-stop-500/30 bg-stop-500/10 px-3 py-2 text-sm text-stop-400">
                {error}
              </p>
            ) : null}
            <Button type="submit" fullWidth size="lg" loading={submitting}>
              Sign in
            </Button>
          </form>

          {process.env.NODE_ENV !== "production" ? (
            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Development demo accounts
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => submit(undefined, { email: a.email, password: a.password })}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs font-semibold text-slate-300 hover:border-pulse-500/40 hover:bg-pulse-500/10 hover:text-pulse-300"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <p className="mt-6 text-center text-sm text-slate-400">
            New here?{" "}
            <Link href="/register" className="font-semibold text-pulse-400 hover:text-pulse-300">
              Create an account
            </Link>
          </p>
          <p className="mt-3 text-center text-xs text-slate-500">
            First admin for this deployment?{" "}
            <Link href="/admin/setup" className="font-semibold text-nova-300 hover:text-nova-200">Secure setup</Link>
          </p>
        </GlassCard>
      </div>
    </main>
  );
}
