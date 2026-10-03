"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, GlassCard, Toaster } from "@/components/ui";
import { api } from "@/lib/api-client";

export default function InitialAdminSetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ bootstrapToken: "", name: "", email: "", phone: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof typeof form) {
    return (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api<{ user: { id: string } }>("/auth/bootstrap-admin", { body: form });
      setForm({ bootstrapToken: "", name: "", email: "", phone: "", password: "" });
      router.replace("/admin");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the initial administrator");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-night-950 px-4 py-10">
      <Toaster />
      <div className="w-full max-w-lg">
        <Link href="/" className="mb-6 block text-center font-display text-xl font-bold text-slate-100">
          MALTOWN <span className="text-pulse-400">RiDE</span>
        </Link>
        <GlassCard className="p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold text-slate-50">Set up the first administrator</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            This one-time setup only works while the database has no admin. Enter the bootstrap token from the Render service environment.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Render bootstrap token" type="password" autoComplete="off" required minLength={32} value={form.bootstrapToken} onChange={set("bootstrapToken")} />
            <Field label="Full name" autoComplete="name" required value={form.name} onChange={set("name")} />
            <Field label="Email" type="email" autoComplete="email" required value={form.email} onChange={set("email")} />
            <Field label="Phone" type="tel" autoComplete="tel" required value={form.phone} onChange={set("phone")} placeholder="+27 82 000 0000" />
            <Field label="Strong password" type="password" autoComplete="new-password" required minLength={12} value={form.password} onChange={set("password")} />
            {error ? <p role="alert" className="rounded-lg border border-stop-500/30 bg-stop-500/10 px-3 py-2 text-sm text-stop-400">{error}</p> : null}
            <Button type="submit" fullWidth size="lg" variant="nova" loading={submitting}>Create admin account</Button>
          </form>
          <p className="mt-5 text-center text-xs text-slate-500">After setup, remove or rotate `ADMIN_BOOTSTRAP_TOKEN` in Render.</p>
          <p className="mt-4 text-center text-sm text-slate-400"><Link href="/login" className="font-semibold text-pulse-400">Back to sign in</Link></p>
        </GlassCard>
      </div>
    </main>
  );
}