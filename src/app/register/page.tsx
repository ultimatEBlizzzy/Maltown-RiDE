"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Button, Field, GlassCard, SelectField, toast, Toaster } from "@/components/ui";
import { roleHome } from "@/hooks/useUser";
import { api } from "@/lib/api-client";
import type { UserDto, UserRole } from "@/lib/types";

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialRole: UserRole = params.get("role") === "DRIVER" ? "DRIVER" : "RIDER";

  const [role, setRole] = useState<UserRole>(initialRole);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [licenseNumber, setLicenseNumber] = useState("");
  const [vehicle, setVehicle] = useState({
    make: "",
    model: "",
    year: new Date().getFullYear() - 4,
    color: "",
    registration: "",
    vehicleType: "SEDAN" as "SEDAN" | "HATCHBACK" | "SUV" | "MINIBUS" | "MOTO",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        ...form,
        role,
        ...(role === "DRIVER"
          ? { licenseNumber: licenseNumber || "MW-NEW-0001", vehicle: { ...vehicle, year: Number(vehicle.year) } }
          : {}),
      };
      const data = await api<{ user: UserDto; otpDev?: string }>("/auth/register", { body });
      if (data.otpDev) toast(`Phone verification code (dev): ${data.otpDev}`, "info");
      toast(`Account created — welcome, ${data.user.name.split(" ")[0]}!`, "success");
      router.push(roleHome(data.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-night-950 px-4 py-10">
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute -top-32 right-1/4 h-[380px] w-[560px] rounded-full bg-nova-500/10 blur-[130px]" />
      </div>
      <Toaster />
      <div className="relative w-full max-w-lg">
        <Link href="/" className="mb-6 block text-center font-display text-xl font-bold text-slate-100">
          MALTOWN <span className="text-pulse-400">RiDE</span>
        </Link>
        <GlassCard className="mt-slide-up p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold text-slate-50">Create your account</h1>
          <p className="mt-1 text-sm text-slate-400">Join Malamulele&apos;s local mobility network.</p>

          {/* role switch */}
          <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-night-900/60 p-1.5" role="tablist" aria-label="Account type">
            {(["RIDER", "DRIVER"] as const).map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={role === r}
                onClick={() => setRole(r)}
                className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                  role === r ? "bg-pulse-500 text-night-950 shadow-[0_4px_16px_rgba(61,155,255,0.35)]" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {r === "RIDER" ? "I need rides" : "I drive"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label="Full name" required value={form.name} onChange={set("name")} placeholder="Your full name" autoComplete="name" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" type="email" required value={form.email} onChange={set("email")} placeholder="you@example.com" autoComplete="email" />
              <Field label="Phone" required value={form.phone} onChange={set("phone")} placeholder="+27 82 000 0000" autoComplete="tel" />
            </div>
            <Field label="Password" type="password" required minLength={8} value={form.password} onChange={set("password")} placeholder="At least 8 characters" autoComplete="new-password" />

            {role === "DRIVER" ? (
              <div className="space-y-4 rounded-xl border border-nova-500/20 bg-nova-500/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-nova-300">Driver & vehicle details</p>
                <Field label="Licence number" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="DL-12345" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Vehicle make" required value={vehicle.make} onChange={(e) => setVehicle((v) => ({ ...v, make: e.target.value }))} placeholder="Toyota" />
                  <Field label="Vehicle model" required value={vehicle.model} onChange={(e) => setVehicle((v) => ({ ...v, model: e.target.value }))} placeholder="Corolla" />
                  <Field label="Year" type="number" required min={1990} max={new Date().getFullYear() + 1} value={vehicle.year} onChange={(e) => setVehicle((v) => ({ ...v, year: Number(e.target.value) }))} />
                  <Field label="Colour" required value={vehicle.color} onChange={(e) => setVehicle((v) => ({ ...v, color: e.target.value }))} placeholder="Silver" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Registration" required value={vehicle.registration} onChange={(e) => setVehicle((v) => ({ ...v, registration: e.target.value }))} placeholder="LIM 123 L" />
                  <SelectField label="Vehicle type" value={vehicle.vehicleType} onChange={(e) => setVehicle((v) => ({ ...v, vehicleType: e.target.value as typeof v.vehicleType }))}>
                    <option value="SEDAN">Sedan (RiDE Go)</option>
                    <option value="HATCHBACK">Hatchback (RiDE Go)</option>
                    <option value="SUV">SUV (RiDE Comfort)</option>
                    <option value="MINIBUS">Minibus (RiDE Comfort)</option>
                    <option value="MOTO">Motorbike (RiDE Moto)</option>
                  </SelectField>
                </div>
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="rounded-lg border border-stop-500/30 bg-stop-500/10 px-3 py-2 text-sm text-stop-400">
                {error}
              </p>
            ) : null}

            <Button type="submit" fullWidth size="lg" loading={submitting} variant={role === "DRIVER" ? "nova" : "primary"}>
              {role === "DRIVER" ? "Start driving" : "Start riding"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already registered?{" "}
            <Link href="/login" className="font-semibold text-pulse-400 hover:text-pulse-300">
              Sign in
            </Link>
          </p>
        </GlassCard>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
