"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { classLabel } from "@/components/ride-bits";
import {
  Avatar,
  Badge,
  Button,
  GlassCard,
  LoadingState,
  Modal,
  StatCard,
  StatusPill,
  toast,
  Toaster,
  Wordmark,
} from "@/components/ui";
import { usePoll } from "@/hooks/usePoll";
import { useUser } from "@/hooks/useUser";
import { api } from "@/lib/api-client";
import { advanceAlongPolyline, nearestPolylineIndex } from "@/lib/geo";
import { useVehicleImage } from "@/hooks/useVehicleImage";
import { MARKET_CENTER } from "@/lib/market";
import {
  formatZAR,
  type EarningsDto,
  type LatLng,
  type RideDto,
  type UserDto,
  type VehicleDto,
} from "@/lib/types";
import { VehicleArtwork } from "@/components/vehicle-artwork";

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
  vehicle?: VehicleDto;
  vehicleImageUrl?: string;
};

/** Development fallback point: Malamulele town centre. */
const FALLBACK: LatLng = MARKET_CENTER;

interface DriverRequest {
  rideId: string;
  pickupAddress: string;
  destinationAddress: string;
  pickupLat: number;
  pickupLng: number;
  destLat: number;
  destLng: number;
  distanceToPickupKm: number;
  tripDistanceKm: number;
  estFare: number;
  riderName: string;
  vehiclePref: string;
  requestedAt: string;
  expiresAt: string;
}

interface DriverSummary {
  isOnline: boolean;
  rating: number;
  totalTrips: number;
  totalEarnings: number;
}

function DriverGate() {
  const { user, loading, driver, vehicle } = useUser("DRIVER");
  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-night-950">
        <LoadingState label="Opening driver console…" />
      </div>
    );
  }
  return (
    <DriverApp
      user={user}
      initialOnline={driver?.isOnline ?? false}
      rating={driver?.rating ?? 5}
      vehicle={vehicle ?? null}
    />
  );
}

export default function DriverPage() {
  return <DriverGate />;
}

function DriverApp({
  user,
  initialOnline,
  rating,
  vehicle,
}: {
  user: UserDto;
  initialOnline: boolean;
  rating: number;
  vehicle: VehicleDto | null;
}) {
  const [online, setOnline] = useState(initialOnline);
  const [toggling, setToggling] = useState(false);
  const [myPos, setMyPos] = useState<LatLng | null>(null);
  const [requests, setRequests] = useState<DriverRequest[]>([]);
  const [declined, setDeclined] = useState<Set<string>>(new Set());
  const [ride, setRide] = useState<RideDto | null>(null);
  const [earnings, setEarnings] = useState<EarningsDto | null>(null);
  const [tab, setTab] = useState<"requests" | "earnings">("requests");
  const [simulate, setSimulate] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [completeSummary, setCompleteSummary] = useState<RideDto | null>(null);
  const vehiclePhoto = useVehicleImage(vehicle?.make, vehicle?.model);

  const rideRef = useRef(ride);
  rideRef.current = ride;
  const posRef = useRef<LatLng | null>(null);
  posRef.current = myPos;
  const simulationCursorRef = useRef<{ key: string; segmentIndex: number; position: LatLng; finished: boolean } | null>(null);

  const visibleRequests = requests.filter((r) => !declined.has(r.rideId));

  /* Refresh summary earnings. */
  async function refreshEarnings() {
    try {
      setEarnings(await api<EarningsDto>("/drivers/me/earnings"));
    } catch {
      /* surface silently; retried by polling */
    }
  }

  useEffect(() => {
    void refreshEarnings();
  }, []);

  usePoll(refreshEarnings, 20000, true);

  /* Poll incoming requests while online and idle. */
  usePoll(
    async () => {
      const d = await api<{ requests: DriverRequest[] }>("/drivers/requests");
      setRequests(d.requests);
    },
    3000,
    online && !ride,
  );

  /* Poll active ride state. */
  usePoll(
    async () => {
      const d = await api<{ rides: RideDto[] }>("/rides?scope=active");
      if (d.rides.length > 0) {
        setRide(d.rides[0]);
        return;
      }
      const current = rideRef.current;
      if (current && current.status !== "COMPLETED" && current.status !== "CANCELLED") {
        try {
          const final = await api<{ ride: RideDto }>(`/rides/${current.id}`);
          setRide(final.ride);
        } catch {
          setRide(null);
        }
      }
    },
    2500,
    true,
  );

  /* Demo-only movement follows the stored road polyline for each leg. */
  usePoll(
    async () => {
      const current = rideRef.current;
      const pos = posRef.current;
      if (!current || !pos) return;
      if (current.status === "COMPLETED" || current.status === "CANCELLED" || current.status === "DRIVER_ARRIVED") return;
      const tripLeg = current.status === "IN_PROGRESS";
      const routeLine = tripLeg ? current.routeLine : current.approachRouteLine;
      if (!routeLine || routeLine.length < 2) return;
      const points = routeLine.map(([lat, lng]) => ({ lat, lng }));
      const routeKey = `${current.id}:${tripLeg ? "trip" : "approach"}:${points.length}`;
      let cursor = simulationCursorRef.current;
      if (!cursor || cursor.key !== routeKey) {
        const segmentIndex = nearestPolylineIndex(pos, points);
        cursor = { key: routeKey, segmentIndex, position: points[segmentIndex], finished: false };
      }
      if (cursor.finished) return;
      const next = advanceAlongPolyline(points, cursor.segmentIndex, (26 * 2.5) / 3600, cursor.position);
      if (!next) return;
      simulationCursorRef.current = { key: routeKey, segmentIndex: next.segmentIndex, position: next.position, finished: next.finished };
      setMyPos(next.position);
      await api("/drivers/location", { body: { lat: next.position.lat, lng: next.position.lng, heading: next.heading } }).catch(() => undefined);
    },
    2500,
    simulate && Boolean(ride) && ride?.status !== "COMPLETED",
  );

  async function toggleOnline() {
    setToggling(true);
    try {
      if (!online) {
        let point = FALLBACK;
        try {
          point = await new Promise<LatLng>((resolve, reject) => {
            if (!navigator.geolocation) return reject(new Error("no geolocation"));
            navigator.geolocation.getCurrentPosition(
              (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
              () => reject(new Error("denied")),
              { timeout: 5000 },
            );
          });
        } catch {
          toast("Location unavailable — using city centre", "warn");
        }
        await api("/drivers/online", { body: { lat: point.lat, lng: point.lng } });
        setMyPos(point);
        setOnline(true);
        toast("You're online — requests will appear here", "success");
      } else {
        await api("/drivers/offline", { method: "POST" });
        setOnline(false);
        toast("You're offline", "info");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not change availability", "danger");
    } finally {
      setToggling(false);
    }
  }

  async function acceptRequest(req: DriverRequest) {
    setBusy(req.rideId);
    try {
      const d = await api<{ ride: RideDto }>(`/rides/${req.rideId}/accept`, { method: "POST" });
      setRide(d.ride);
      setRequests([]);
      if (d.ride.driverLocation) setMyPos({ lat: d.ride.driverLocation.lat, lng: d.ride.driverLocation.lng });
      toast("Ride accepted — head to pickup", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not accept", "danger");
    } finally {
      setBusy(null);
    }
  }

  async function declineRequest(req: DriverRequest) {
    setDeclined((prev) => new Set(prev).add(req.rideId));
    await api(`/rides/${req.rideId}/decline`, { method: "POST" }).catch(() => undefined);
  }

  async function runAction(action: "arrive" | "start" | "complete") {
    if (!ride) return;
    setBusy(action);
    try {
      const d = await api<{ ride: RideDto }>(`/rides/${ride.id}/${action}`, { method: "POST" });
      setRide(d.ride);
      if (action === "complete") {
        setCompleteSummary(d.ride);
        void refreshEarnings();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action failed", "danger");
    } finally {
      setBusy(null);
    }
  }

  async function cancelRide() {
    if (!ride) return;
    try {
      await api(`/rides/${ride.id}/cancel`, { body: { reason: "driver cancelled" } });
      toast("Ride cancelled", "warn");
      setRide(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not cancel", "danger");
    }
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/login";
  }

  const markers = useMemo<MapMarkerSpec[]>(() => {
    const list: MapMarkerSpec[] = [];
    if (myPos) list.push({ id: "me", lat: myPos.lat, lng: myPos.lng, kind: "driver", heading: 0, vehicle: vehicle ?? undefined, vehicleImageUrl: vehiclePhoto?.url });
    if (ride && ride.status !== "COMPLETED" && ride.status !== "CANCELLED") {
      list.push({ id: "pickup", lat: ride.pickup.lat, lng: ride.pickup.lng, kind: "pickup", heading: 0 });
      list.push({ id: "dest", lat: ride.destination.lat, lng: ride.destination.lng, kind: "destination", heading: 0 });
    }
    if (!ride && visibleRequests[0]) {
      list.push({ id: "req-pickup", lat: visibleRequests[0].pickupLat, lng: visibleRequests[0].pickupLng, kind: "pickup", heading: 0 });
      list.push({ id: "req-dest", lat: visibleRequests[0].destLat, lng: visibleRequests[0].destLng, kind: "destination", heading: 0 });
    }
    return list;
  }, [myPos, ride, visibleRequests, vehicle, vehiclePhoto]);

  const activeStatus = ride?.status;

  return (
    <main className="relative h-screen w-full overflow-hidden bg-night-950">
      <Toaster />
      <div className="absolute inset-0 z-0">
        <MapView
          center={myPos ?? ride?.driverLocation ?? FALLBACK}
          markers={markers}
          route={ride ? (ride.status === "IN_PROGRESS" ? ride.routeLine : ride.approachRouteLine) : null}
          fitKey={`${ride?.id ?? "idle"}:${ride?.status ?? ""}`}
        />
      </div>

      {/* top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[1001] flex items-center justify-between p-3 sm:p-4">
        <div className="pointer-events-auto glass flex items-center gap-2 rounded-xl px-3.5 py-2">
          <Wordmark compact />
          <Badge tone={online ? "success" : "info"}>{online ? "ONLINE" : "OFFLINE"}</Badge>
        </div>
        <div className="pointer-events-auto glass flex items-center gap-2 rounded-xl px-2.5 py-1.5">
          <Avatar name={user.name} size={28} />
          <span className="hidden text-sm font-semibold text-slate-200 sm:block">{user.name.split(" ")[0]}</span>
          <button onClick={logout} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-slate-200">
            Sign out
          </button>
        </div>
      </header>

      {/* panel */}
      <section
        aria-label="Driver panel"
        className="glass absolute inset-x-0 bottom-0 z-[1000] max-h-[70vh] overflow-y-auto rounded-t-2xl p-4 sm:inset-auto sm:bottom-4 sm:left-4 sm:top-16 sm:max-h-none sm:w-[400px] sm:rounded-2xl sm:p-5"
      >
        {/* availability + stats */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {vehicle ? <VehicleArtwork {...vehicle} compact /> : null}
            <div className="min-w-0">
              <p className="font-display text-lg font-bold text-slate-100">Command center</p>
              <p className="truncate text-xs text-slate-400">
                {vehicle ? `${vehicle.color} ${vehicle.make} ${vehicle.model} · ${vehicle.registration}` : "No vehicle on file"}
              </p>
            </div>
          </div>
          <button
            role="switch"
            aria-checked={online}
            aria-label="Go online"
            onClick={toggleOnline}
            disabled={toggling || Boolean(ride)}
            className={`relative h-8 w-16 shrink-0 rounded-full transition disabled:opacity-60 ${online ? "bg-go-500" : "bg-white/10"}`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${online ? "left-9" : "left-1"}`}
            />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatCard label="Today" value={earnings ? formatZAR(earnings.today) : "—"} accent="go" />
          <StatCard label="Rating" value={rating.toFixed(2)} accent="warn" />
          <StatCard label="Trips" value={earnings?.completedTrips ?? "—"} accent="pulse" />
        </div>

        {/* tabs */}
        {!ride ? (
          <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-night-900/60 p-1.5" role="tablist">
            {(
              [
                ["requests", `Requests${visibleRequests.length ? ` (${visibleRequests.length})` : ""}`],
                ["earnings", "Earnings"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`rounded-lg px-3 py-2 text-sm font-bold transition ${tab === id ? "bg-pulse-500 text-night-950" : "text-slate-400 hover:text-slate-200"}`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {/* incoming request cards */}
        {!ride && tab === "requests" ? (
          <div className="mt-4 space-y-3">
            {!online ? (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
                <p className="font-display text-sm font-semibold text-slate-300">You&apos;re offline</p>
                <p className="mt-1 text-xs text-slate-500">Flip the switch above to start receiving ride requests.</p>
              </div>
            ) : visibleRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
                <p className="font-display text-sm font-semibold text-slate-300">Waiting for requests…</p>
                <p className="mt-1 text-xs text-slate-500">Nearby riders will pop up here automatically.</p>
              </div>
            ) : (
              visibleRequests.map((req) => <RequestCard key={req.rideId} req={req} busy={busy === req.rideId} onAccept={() => acceptRequest(req)} onDecline={() => declineRequest(req)} />)
            )}
          </div>
        ) : null}

        {/* earnings tab */}
        {!ride && tab === "earnings" ? (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Today" value={earnings ? formatZAR(earnings.today) : "—"} accent="go" />
              <StatCard label="This week" value={earnings ? formatZAR(earnings.week) : "—"} accent="pulse" />
              <StatCard label="Total" value={earnings ? formatZAR(earnings.total) : "—"} accent="nova" />
            </div>
            <p className="text-xs text-slate-500">
              {earnings?.completedTrips ?? 0} completed trips · driver share {Math.round(0.8 * 100)}%
            </p>
            {earnings && earnings.recent.length > 0 ? (
              <div className="space-y-2">
                {earnings.recent.map((r) => (
                  <div key={r.id} className="glass-soft rounded-xl px-3.5 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-slate-300">
                        {r.pickupAddress} → {r.destinationAddress}
                      </p>
                      <span className="shrink-0 font-semibold tabular-nums text-go-400">+{formatZAR(r.driverShare)}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      {r.completedAt ? new Date(r.completedAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* active ride */}
        {ride && activeStatus !== "COMPLETED" && activeStatus !== "CANCELLED" ? (
          <ActiveRidePanel
            ride={ride}
            busy={busy}
            simulate={simulate}
            onSimulateChange={setSimulate}
            onArrive={() => runAction("arrive")}
            onStart={() => runAction("start")}
            onComplete={() => runAction("complete")}
            onCancel={cancelRide}
          />
        ) : null}

        {ride && activeStatus === "CANCELLED" ? (
          <div className="mt-slide-up mt-4 space-y-3 text-center">
            <p className="font-display font-bold text-slate-100">Ride cancelled</p>
            <Button fullWidth onClick={() => setRide(null)}>
              Back to requests
            </Button>
          </div>
        ) : null}
      </section>

      {/* completion summary modal */}
      <Modal open={Boolean(completeSummary)} onClose={() => setCompleteSummary(null)} title="Trip completed">
        {completeSummary ? (
          <div className="space-y-3">
            <p className="text-center font-display text-3xl font-bold text-go-400 tabular-nums">
              {formatZAR(completeSummary.finalFare ?? completeSummary.estFare)}
            </p>
            <p className="text-center text-sm text-slate-400">
              Your share: <strong className="text-go-400">{formatZAR(Math.round((completeSummary.finalFare ?? completeSummary.estFare) * 0.8))}</strong>
              {" · "}
              {completeSummary.distanceKm.toFixed(1)} km
            </p>
            <Button
              fullWidth
              onClick={() => {
                setCompleteSummary(null);
                setRide(null);
              }}
            >
              Back online
            </Button>
          </div>
        ) : null}
      </Modal>
    </main>
  );
}

function RequestCard({
  req,
  busy,
  onAccept,
  onDecline,
}: {
  req: DriverRequest;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.round((new Date(req.expiresAt).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.round((new Date(req.expiresAt).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [req.expiresAt]);

  return (
    <article className="mt-slide-up glass-soft rounded-xl border border-pulse-500/25 p-4">
      <div className="flex items-center justify-between">
        <Badge tone="accent">NEW REQUEST · {classLabel(req.vehiclePref)}</Badge>
        <span className={`font-display text-sm font-bold tabular-nums ${secondsLeft <= 10 ? "text-stop-400" : "text-slate-300"}`}>{secondsLeft}s</span>
      </div>
      <div className="mt-3 space-y-1.5 text-sm">
        <p className="text-slate-200">
          <span className="mr-2 inline-block h-2 w-2 rounded-full border-2 border-go-400" aria-hidden />
          {req.pickupAddress} <span className="text-slate-500">({req.distanceToPickupKm} km away)</span>
        </p>
        <p className="text-slate-400">
          <span className="mr-2 inline-block h-2 w-2 rotate-45 bg-nova-400" aria-hidden />
          {req.destinationAddress} · {req.tripDistanceKm.toFixed(1)} km
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-slate-500">{req.riderName} · est. fare</p>
        <p className="font-display text-lg font-bold text-pulse-400 tabular-nums">{formatZAR(req.estFare)}</p>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
        <Button variant="ghost" onClick={onDecline} disabled={busy}>
          Decline
        </Button>
        <Button variant="success" onClick={onAccept} loading={busy}>
          Accept ride
        </Button>
      </div>
    </article>
  );
}

function ActiveRidePanel({
  ride,
  busy,
  simulate,
  onSimulateChange,
  onArrive,
  onStart,
  onComplete,
  onCancel,
}: {
  ride: RideDto;
  busy: string | null;
  simulate: boolean;
  onSimulateChange: (v: boolean) => void;
  onArrive: () => void;
  onStart: () => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const cancellable = ride.status !== "IN_PROGRESS";
  return (
    <div className="mt-slide-up mt-4 space-y-3.5 border-t border-white/10 pt-4">
      <div className="flex items-center justify-between">
        <StatusPill status={ride.status} />
        <span className="font-display text-base font-bold text-pulse-400 tabular-nums">{formatZAR(ride.estFare)}</span>
      </div>
      <div className="glass-soft rounded-xl p-3.5 text-sm">
        <p className="flex items-center gap-2 text-slate-200">
          <Avatar name={ride.pickup.address} size={22} />
          {ride.pickup.address}
        </p>
        <p className="mt-2 flex items-center gap-2 text-slate-400">
          <span className="grid h-[22px] w-[22px] place-items-center"><span className="h-2.5 w-2.5 rotate-45 bg-nova-400" /></span>
          {ride.destination.address}
        </p>
      </div>
      <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-slate-300">
        <span>
          Auto-drive demo
          <span className="block text-[11px] text-slate-500">Simulates GPS movement along the route</span>
        </span>
        <button
          role="switch"
          aria-checked={simulate}
          aria-label="Toggle auto-drive simulation"
          onClick={() => onSimulateChange(!simulate)}
          className={`relative h-6 w-12 rounded-full transition ${simulate ? "bg-pulse-500" : "bg-white/10"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${simulate ? "left-6" : "left-0.5"}`} />
        </button>
      </label>

      {ride.status === "DRIVER_ARRIVING" || ride.status === "ACCEPTED" ? (
        <Button fullWidth size="lg" variant="primary" loading={busy === "arrive"} onClick={onArrive}>
          I&apos;ve arrived at pickup
        </Button>
      ) : ride.status === "DRIVER_ARRIVED" ? (
        <Button fullWidth size="lg" variant="nova" loading={busy === "start"} onClick={onStart}>
          Start trip
        </Button>
      ) : ride.status === "IN_PROGRESS" ? (
        <Button fullWidth size="lg" variant="success" loading={busy === "complete"} onClick={onComplete}>
          Complete trip
        </Button>
      ) : null}

      {cancellable ? (
        <button onClick={onCancel} className="w-full text-center text-xs font-semibold text-slate-500 hover:text-stop-400">
          Cancel ride
        </button>
      ) : null}
    </div>
  );
}
