"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, EmptyState, ErrorState, GlassCard, LoadingState, StatCard, StatusPill, toast, Toaster, Wordmark } from "@/components/ui";
import { usePoll } from "@/hooks/usePoll";
import { useUser } from "@/hooks/useUser";
import { api } from "@/lib/api-client";
import { MARKET_CENTER } from "@/lib/market";
import {
  formatZAR,
  type AdminDriverRow,
  type AdminPaymentRow,
  type AdminRideRow,
  type AdminRiderRow,
  type DashboardDto,
  type RideStatus,
} from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-night-900 text-slate-500">Loading map…</div>,
});
type MapMarkerSpec = {
  id: string;
  lat: number;
  lng: number;
  kind: "driver" | "pickup" | "destination" | "user";
  heading?: number;
  idle?: boolean;
};

const CENTER = MARKET_CENTER;

function AdminGate() {
  const { user, loading } = useUser("ADMIN");
  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-night-950">
        <LoadingState label="Opening operations console…" />
      </div>
    );
  }
  return <AdminApp name={user.name} />;
}

export default function AdminPage() {
  return <AdminGate />;
}

type Tab = "rides" | "drivers" | "riders" | "payments";

function AdminApp({ name }: { name: string }) {
  const [dash, setDash] = useState<DashboardDto | null>(null);
  const [dashError, setDashError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("rides");
  const [search, setSearch] = useState("");

  async function loadDashboard() {
    try {
      setDash(await api<DashboardDto>("/admin/dashboard"));
      setDashError(null);
    } catch (err) {
      setDashError(err instanceof Error ? err.message : "Failed to load dashboard");
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);
  usePoll(loadDashboard, 5000, true);

  const markers = useMemo<MapMarkerSpec[]>(() => {
    if (!dash) return [];
    const list: MapMarkerSpec[] = [];
    for (const d of dash.onlineDriverLocations) {
      list.push({ id: `drv-${d.userId}`, lat: d.lat, lng: d.lng, kind: "driver", idle: true, heading: 0 });
    }
    for (const r of dash.liveRides) {
      list.push({ id: `pu-${r.id}`, lat: r.pickup.lat, lng: r.pickup.lng, kind: "pickup", heading: 0 });
      list.push({ id: `ds-${r.id}`, lat: r.destination.lat, lng: r.destination.lng, kind: "destination", heading: 0 });
      if (r.driverLocation) {
        list.push({ id: `act-${r.id}`, lat: r.driverLocation.lat, lng: r.driverLocation.lng, kind: "driver", heading: 0 });
      }
    }
    return list;
  }, [dash]);

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/login";
  }

  if (dashError && !dash) {
    return (
      <div className="grid min-h-screen place-items-center bg-night-950 px-6">
        <div className="w-full max-w-md">
          <ErrorState message={dashError} onRetry={loadDashboard} />
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-night-950 pb-12">
      <Toaster />
      <header className="glass sticky top-0 z-20 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Wordmark compact />
            <Badge tone="nova">OPERATIONS</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-400 sm:block">
              {name} ·{" "}
              <span className={dash?.system.db === "ok" ? "text-go-400" : "text-stop-400"}>
                DB {dash?.system.db ?? "?"} · routing {dash?.system.routingProvider ?? "?"}
              </span>
            </span>
            <Button variant="ghost" size="sm" onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 pt-6 sm:px-6">
        {!dash ? (
          <LoadingState label="Loading operations data…" />
        ) : (
          <>
            {/* stats */}
            <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Riders" value={dash.totals.riders} accent="pulse" />
              <StatCard label="Drivers" value={dash.totals.drivers} sub={`${dash.totals.onlineDrivers} online`} accent="nova" />
              <StatCard label="Active rides" value={dash.totals.activeRides} sub={`${dash.totals.searchingRides} searching`} accent="warn" />
              <StatCard label="Completed today" value={dash.totals.completedToday} sub={`${dash.totals.completedTotal} all-time`} accent="go" />
              <StatCard label="Cancelled" value={dash.totals.cancelledTotal} accent="stop" />
              <StatCard label="Revenue" value={formatZAR(dash.totals.revenueTotal)} accent="pulse" />
            </section>

            {/* live map + recent rides */}
            <section className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
              <GlassCard className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <h2 className="font-display text-sm font-bold text-slate-100">Live network map</h2>
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-go-400" /> {dash.liveRides.length} live rides · {dash.onlineDriverLocations.length} drivers online
                  </span>
                </div>
                <div className="h-[320px]">
                  <MapView center={CENTER} markers={markers} fitKey={`ops-${dash.liveRides.length}`} zoom={13} />
                </div>
              </GlassCard>

              <GlassCard className="flex flex-col overflow-hidden">
                <div className="border-b border-white/10 px-4 py-3">
                  <h2 className="font-display text-sm font-bold text-slate-100">Recent rides</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  {dash.recentRides.length === 0 ? (
                    <EmptyState title="No rides yet" body="Rides will appear here as the network moves." />
                  ) : (
                    <ul className="space-y-2">
                      {dash.recentRides.map((r) => (
                        <li key={r.id} className="glass-soft rounded-xl px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-xs text-slate-300">
                              {r.pickupAddress} → {r.destinationAddress}
                            </p>
                            <StatusPill status={r.status} />
                          </div>
                          <p className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                            <span>
                              {r.riderName}
                              {r.driverName ? ` · ${r.driverName}` : ""}
                            </span>
                            <span className="tabular-nums">{r.finalFare != null ? formatZAR(r.finalFare) : formatZAR(r.estFare)}</span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </GlassCard>
            </section>

            {/* tables */}
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1.5 rounded-xl border border-white/10 bg-night-900/60 p-1.5" role="tablist" aria-label="Registry tables">
                  {(["rides", "drivers", "riders", "payments"] as Tab[]).map((t) => (
                    <button
                      key={t}
                      role="tab"
                      aria-selected={tab === t}
                      onClick={() => setTab(t)}
                      className={`rounded-lg px-3.5 py-1.5 text-sm font-bold capitalize transition ${tab === t ? "bg-pulse-500 text-night-950" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  className="input-base max-w-xs"
                  placeholder={`Search ${tab}…`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label={`Search ${tab}`}
                />
              </div>

              {tab === "rides" && <RidesTable search={search} />}
              {tab === "drivers" && <DriversTable search={search} />}
              {tab === "riders" && <RidersTable search={search} />}
              {tab === "payments" && <PaymentsTable search={search} />}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

/* ------------------------------- table hooks ------------------------------- */

function useDebounced(value: string, ms = 350): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <GlassCard className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">{children}</table>
      </div>
    </GlassCard>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-white/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-white/5 px-4 py-2.5 text-slate-300 ${className}`}>{children}</td>;
}

function TableState<T>({ rows, error, loading, onRetry, render, empty }: { rows: T[] | null; error: string | null; loading: boolean; onRetry: () => void; render: (rows: T[]) => React.ReactNode; empty: string }) {
  if (error)
    return (
      <div className="p-4">
        <ErrorState message={error} onRetry={onRetry} />
      </div>
    );
  if (loading || rows === null) return <LoadingState label="Loading table…" />;
  if (rows.length === 0)
    return (
      <div className="p-4">
        <EmptyState title={empty} />
      </div>
    );
  return <>{render(rows)}</>;
}

function RidesTable({ search }: { search: string }) {
  const debounced = useDebounced(search);
  const [rows, setRows] = useState<AdminRideRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | RideStatus>("");

  async function load() {
    try {
      const params = new URLSearchParams();
      if (debounced) params.set("search", debounced);
      if (statusFilter) params.set("status", statusFilter);
      const d = await api<{ rides: AdminRideRow[] }>(`/admin/rides?${params.toString()}`);
      setRows(d.rides);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rides");
    }
  }

  useEffect(() => {
    setRows(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, statusFilter]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(["", "SEARCHING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const).map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s as "" | RideStatus)}
            className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
              statusFilter === s ? "border-pulse-500/60 bg-pulse-500/15 text-pulse-300" : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
            }`}
          >
            {s === "" ? "All statuses" : s.replace(/_/g, " ").toLowerCase()}
          </button>
        ))}
      </div>
      <TableState
        rows={rows}
        error={error}
        loading={false}
        onRetry={load}
        empty="No rides match"
        render={(data) => (
          <TableShell>
            <thead>
              <tr>
                <Th>Route</Th>
                <Th>Rider</Th>
                <Th>Driver</Th>
                <Th>Status</Th>
                <Th>Fare</Th>
                <Th>Payment</Th>
                <Th>Requested</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.03]">
                  <Td>
                    <span className="block max-w-[220px] truncate">{r.pickupAddress} → {r.destinationAddress}</span>
                  </Td>
                  <Td>{r.riderName}</Td>
                  <Td>{r.driverName ?? "—"}</Td>
                  <Td>
                    <StatusPill status={r.status} />
                  </Td>
                  <Td className="tabular-nums">{r.finalFare != null ? formatZAR(r.finalFare) : formatZAR(r.estFare)}</Td>
                  <Td>{r.paymentStatus ? <Badge tone={r.paymentStatus === "SUCCESS" ? "success" : r.paymentStatus === "PENDING" ? "warn" : "danger"}>{r.paymentStatus}</Badge> : "—"}</Td>
                  <Td className="whitespace-nowrap text-xs text-slate-500">{new Date(r.requestedAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      />
    </div>
  );
}

function DriversTable({ search }: { search: string }) {
  const debounced = useDebounced(search);
  const [rows, setRows] = useState<AdminDriverRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const params = debounced ? `?search=${encodeURIComponent(debounced)}` : "";
      const d = await api<{ drivers: AdminDriverRow[] }>(`/admin/drivers${params}`);
      setRows(d.drivers);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drivers");
    }
  }

  useEffect(() => {
    setRows(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <TableState
      rows={rows}
      error={error}
      loading={false}
      onRetry={load}
      empty="No drivers match"
      render={(data) => (
        <TableShell>
          <thead>
            <tr>
              <Th>Driver</Th>
              <Th>Vehicle</Th>
              <Th>Status</Th>
              <Th>Rating</Th>
              <Th>Trips</Th>
              <Th>Earnings</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.userId} className="hover:bg-white/[0.03]">
                <Td>
                  <span className="block font-semibold text-slate-200">{d.name}</span>
                  <span className="block text-xs text-slate-500">{d.email} · {d.phone}</span>
                </Td>
                <Td>
                  {d.vehicle ?? "—"}
                  <span className="block text-xs text-slate-500">{d.registration ?? ""}</span>
                </Td>
                <Td>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={d.isOnline ? "success" : "info"}>{d.isOnline ? "ONLINE" : "OFFLINE"}</Badge>
                    <Badge tone={d.verificationStatus === "VERIFIED" ? "accent" : "warn"}>{d.verificationStatus}</Badge>
                  </span>
                </Td>
                <Td className="tabular-nums">{d.rating.toFixed(2)}</Td>
                <Td className="tabular-nums">{d.totalTrips}</Td>
                <Td className="tabular-nums">{formatZAR(d.totalEarnings)}</Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    />
  );
}

function RidersTable({ search }: { search: string }) {
  const debounced = useDebounced(search);
  const [rows, setRows] = useState<AdminRiderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const params = debounced ? `?search=${encodeURIComponent(debounced)}` : "";
      const d = await api<{ riders: AdminRiderRow[] }>(`/admin/riders${params}`);
      setRows(d.riders);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load riders");
    }
  }

  useEffect(() => {
    setRows(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <TableState
      rows={rows}
      error={error}
      loading={false}
      onRetry={load}
      empty="No riders match"
      render={(data) => (
        <TableShell>
          <thead>
            <tr>
              <Th>Rider</Th>
              <Th>Phone</Th>
              <Th>Joined</Th>
              <Th>Total rides</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id} className="hover:bg-white/[0.03]">
                <Td>
                  <span className="block font-semibold text-slate-200">{r.name}</span>
                  <span className="block text-xs text-slate-500">{r.email}</span>
                </Td>
                <Td>{r.phone}</Td>
                <Td className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</Td>
                <Td className="tabular-nums">{r.totalRides}</Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    />
  );
}

function PaymentsTable({ search }: { search: string }) {
  const debounced = useDebounced(search);
  const [rows, setRows] = useState<AdminPaymentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const params = debounced ? `?search=${encodeURIComponent(debounced)}` : "";
      const d = await api<{ payments: AdminPaymentRow[] }>(`/admin/payments${params}`);
      setRows(d.payments);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payments");
    }
  }

  useEffect(() => {
    setRows(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <TableState
      rows={rows}
      error={error}
      loading={false}
      onRetry={load}
      empty="No payments match"
      render={(data) => (
        <TableShell>
          <thead>
            <tr>
              <Th>Reference</Th>
              <Th>Rider</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
              <Th>Method</Th>
              <Th>Provider</Th>
              <Th>When</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="hover:bg-white/[0.03]">
                <Td className="font-mono text-xs">{p.providerRef ?? p.id.slice(0, 8)}</Td>
                <Td>{p.riderName}</Td>
                <Td className="tabular-nums">{formatZAR(p.amount)}</Td>
                <Td>
                  <Badge tone={p.status === "SUCCESS" ? "success" : p.status === "PENDING" ? "warn" : "danger"}>{p.status}</Badge>
                </Td>
                <Td>{p.method}</Td>
                <Td>{p.provider}</Td>
                <Td className="whitespace-nowrap text-xs text-slate-500">{new Date(p.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    />
  );
}
