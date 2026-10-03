"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Button, Field, GlassCard, SelectField, toast, Toaster } from "@/components/ui";
import { roleHome } from "@/hooks/useUser";
import { api } from "@/lib/api-client";
import { VehicleArtwork } from "@/components/vehicle-artwork";
import { VEHICLE_CATALOG, VEHICLE_COLORS } from "@/lib/vehicle-catalog";
import type { UserDto, UserRole } from "@/lib/types";

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialRole: UserRole = params.get("role") === "DRIVER" ? "DRIVER" : "RIDER";

  const [role, setRole] = useState<UserRole>(initialRole);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [licenseNumber, setLicenseNumber] = useState("");
  const initialMake = VEHICLE_CATALOG[0];
  const initialModel = initialMake.models[1];
  const [vehicle, setVehicle] = useState({
    make: initialMake.make,
    model: initialModel.name,
    year: new Date().getFullYear() - 4,
    color: "White",
    registration: "",
    vehicleType: initialModel.vehicleType,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const selectedMake = VEHICLE_CATALOG.find((option) => option.make === vehicle.make) ?? initialMake;

  function selectMake(make: string) {
    const option = VEHICLE_CATALOG.find((entry) => entry.make === make) ?? initialMake;
    const firstModel = option.models[0];
    setVehicle((current) => ({ ...current, make: option.make, model: firstModel.name, vehicleType: firstModel.vehicleType }));
  }

  function selectModel(modelName: string) {
    const option = selectedMake.models.find((entry) => entry.name === modelName);
    if (!option) return;
    setVehicle((current) => ({ ...current, model: option.name, vehicleType: option.vehicleType }));
  }

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
                <Field label="Licence number" required value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="DL-12345" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField label="Vehicle make" value={vehicle.make} onChange={(e) => selectMake(e.target.value)}>
                    {VEHICLE_CATALOG.map((option) => <option key={option.make} value={option.make}>{option.make}</option>)}
                  </SelectField>
                  <SelectField label="Vehicle model" value={vehicle.model} onChange={(e) => selectModel(e.target.value)}>
                    {selectedMake.models.map((option) => <option key={option.name} value={option.name}>{option.name}</option>)}
                  </SelectField>
                  <Field label="Year" type="number" required min={1990} max={new Date().getFullYear() + 1} value={vehicle.year} onChange={(e) => setVehicle((v) => ({ ...v, year: Number(e.target.value) }))} />
                  <SelectField label="Colour" value={vehicle.color} onChange={(e) => setVehicle((v) => ({ ...v, color: e.target.value }))}>
                    {VEHICLE_COLORS.map((option) => <option key={option.name} value={option.name}>{option.name}</option>)}
                  </SelectField>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Registration" required value={vehicle.registration} onChange={(e) => setVehicle((v) => ({ ...v, registration: e.target.value }))} placeholder="LIM 123 L" />
                  <p className="flex items-end pb-2 text-xs text-slate-400">Vehicle class is set automatically from the selected model.</p>
                </div>
                <VehicleArtwork {...vehicle} compact={false} />
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
