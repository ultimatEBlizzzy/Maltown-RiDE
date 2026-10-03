"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { classLabel, DriverInfoPanel, FareBreakdownView, RideHistoryCard, Stars } from "@/components/ride-bits";
import {
  Avatar,
  Badge,
  Button,
  ErrorState,
  GlassCard,
  LoadingState,
  Modal,
  StatusPill,
  toast,
  Toaster,
  Wordmark,
} from "@/components/ui";
import { usePoll } from "@/hooks/usePoll";
import { useUser } from "@/hooks/useUser";
import { useVehicleImage } from "@/hooks/useVehicleImage";
import { api } from "@/lib/api-client";
import { bearingDeg } from "@/lib/geo";
import { MARKET_CENTER, MARKET_LANDMARKS } from "@/lib/market";
import {
  formatZAR,
  STATUS_META,
  type EstimateResponse,
  type GeoPoint,
  type LatLng,
  type NearbyDriverDto,
  type NotificationDto,
  type PaymentDto,
  type PaymentMethod,
  type RideDto,
  type UserDto,
  type VehicleDto,
  type VehicleClassId,
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
  vehicle?: VehicleDto;
  vehicleImageUrl?: string;
};

const FALLBACK_CENTER: GeoPoint = MARKET_CENTER;
const PLACES = MARKET_LANDMARKS;

type Stage = "plan" | "estimate" | "searching" | "assigned" | "in_progress" | "completed" | "cancelled";

function RiderGate() {
  const { user, loading } = useUser("RIDER");
  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-night-950">
        <LoadingState label="Preparing your ride…" />
      </div>
    );
  }
  return <RiderApp user={user} />;
}

export default function RiderPage() {
  return <RiderGate />;
}

function RiderApp({ user }: { user: UserDto }) {
  const [pickup, setPickup] = useState<GeoPoint | null>(null);
  const [dest, setDest] = useState<GeoPoint | null>(null);
  const [clickMode, setClickMode] = useState<"pickup" | "destination" | null>(null);
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [selectedClass, setSelectedClass] = useState<VehicleClassId>("STANDARD");
  const [ride, setRide] = useState<RideDto | null>(null);
  const [nearby, setNearby] = useState<NearbyDriverDto[]>([]);
  const [history, setHistory] = useState<RideDto[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingSent, setRatingSent] = useState(false);
  const [searchSeconds, setSearchSeconds] = useState(0);

  const rideRef = useRef(ride);
  rideRef.current = ride;
  const lastDriverPos = useRef<LatLng | null>(null);
  const movingVehiclePhoto = useVehicleImage(ride?.driver?.vehicle?.make, ride?.driver?.vehicle?.model);

  const stage: Stage = useMemo(() => {
    if (ride) {
      if (ride.status === "COMPLETED") return "completed";
      if (ride.status === "CANCELLED") return "cancelled";
      if (ride.status === "IN_PROGRESS") return "in_progress";
      if (ride.status === "SEARCHING" || ride.status === "REQUESTED") return "searching";
      return "assigned";
    }
    return estimate ? "estimate" : "plan";
  }, [ride, estimate]);

  /* Initial pickup from geolocation (fallback: Malamulele town centre). */
  useEffect(() => {
    let done = false;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPickup(FALLBACK_CENTER);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!done) setPickup({ lat: pos.coords.latitude, lng: pos.coords.longitude, address: "Current location" });
      },
      () => {
        if (!done) setPickup(FALLBACK_CENTER);
      },
      { timeout: 6000, maximumAge: 30000 },
    );
    return () => {
      done = true;
    };
  }, []);

  /* Live ride polling — single source of truth for the active ride. */
  usePoll(
    async () => {
      const data = await api<{ rides: RideDto[] }>("/rides?scope=active");
      if (data.rides.length > 0) {
        setRide(data.rides[0]);
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
    stage !== "completed",
  );

  /* Nearby drivers visualisation while planning / searching. */
  usePoll(
    async () => {
      if (!pickup) return;
      const d = await api<{ drivers: NearbyDriverDto[] }>(
        `/drivers/nearby?lat=${pickup.lat}&lng=${pickup.lng}`,
      );
      setNearby(d.drivers);
    },
    5000,
    Boolean(pickup) && (stage === "plan" || stage === "estimate" || stage === "searching"),
  );

  /* Search timer */
  useEffect(() => {
    if (stage !== "searching") {
      setSearchSeconds(0);
      return;
    }
    const t = setInterval(() => setSearchSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [stage]);

  /* Notifications (polled; realtime SSE pushes the same events). */
  usePoll(
    async () => {
      const d = await api<{ notifications: NotificationDto[] }>("/notifications");
      const fresh = d.notifications.filter((n) => !n.read);
      if (fresh.length > 0) {
        toast(`${fresh[0].title} — ${fresh[0].body}`, "info");
        await api("/notifications", { method: "POST" });
      }
    },
    12000,
    true,
  );

  /* Driver heading smoothing for the live marker. */
  useEffect(() => {
    if (!ride?.driverLocation) return;
    lastDriverPos.current = { lat: ride.driverLocation.lat, lng: ride.driverLocation.lng };
  }, [ride?.driverLocation]);

  function handleMapClick(point: LatLng) {
    if (!clickMode) return;
    const geo: GeoPoint = { ...point, address: "Pinned location" };
    if (clickMode === "pickup") setPickup(geo);
    else setDest(geo);
    setClickMode(null);
  }

  async function getEstimate() {
    if (!pickup || !dest) return;
    setEstimating(true);
    try {
      const d = await api<EstimateResponse>("/rides/estimate", {
        body: { pickup: { lat: pickup.lat, lng: pickup.lng }, destination: { lat: dest.lat, lng: dest.lng } },
      });
      setEstimate(d);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not estimate fare", "danger");
    } finally {
      setEstimating(false);
    }
  }

  async function requestRide() {
    if (!pickup || !dest) return;
    setRequesting(true);
    try {
      const d = await api<{ ride: RideDto; nearbyCandidates: number }>("/rides", {
        body: { pickup, destination: dest, vehiclePref: selectedClass },
      });
      setRide(d.ride);
      setEstimate(null);
      if (d.nearbyCandidates === 0) {
        toast("No drivers in range yet — your request stays live", "warn");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not request ride", "danger");
    } finally {
      setRequesting(false);
    }
  }

  async function cancelRide(reason?: string) {
    if (!ride) return;
    try {
      await api(`/rides/${ride.id}/cancel`, { body: { reason } });
      toast("Ride cancelled", "warn");
      setRide(null);
      setEstimate(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not cancel", "danger");
    }
  }

  async function loadHistory() {
    setHistoryError(null);
    try {
      const d = await api<{ rides: RideDto[] }>("/rides?scope=history");
      setHistory(d.rides);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Failed to load history");
    }
  }

  function toggleHistory() {
    const next = !showHistory;
    setShowHistory(next);
    setShowPayments(false);
    if (next && history === null) void loadHistory();
  }

  function togglePayments() {
    const next = !showPayments;
    setShowPayments(next);
    setShowHistory(false);
    if (next && history === null) void loadHistory();
  }

  async function submitRating() {
    if (!ride || ratingScore === 0) return;
    try {
      await api(`/rides/${ride.id}/rate`, { body: { score: ratingScore } });
      setRatingSent(true);
      toast("Thanks for rating your driver!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not submit rating", "danger");
    }
  }

  function finishReceipt() {
    setRide(null);
    setDest(null);
    setRatingScore(0);
    setRatingSent(false);
    lastDriverPos.current = null;
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/login";
  }

  /* ------------------------------ map layers ------------------------------ */

  const markers = useMemo<MapMarkerSpec[]>(() => {
    const list: MapMarkerSpec[] = [];
    if (stage === "plan" || stage === "estimate" || stage === "searching") {
      for (const d of nearby) {
        list.push({ id: `nb-${d.userId}`, lat: d.lat, lng: d.lng, kind: "driver", idle: true, heading: 0, vehicle: d.vehicle });
      }
    }
    if (pickup) list.push({ id: "pickup", lat: pickup.lat, lng: pickup.lng, kind: "pickup", heading: 0 });
    if (dest) list.push({ id: "dest", lat: dest.lat, lng: dest.lng, kind: "destination", heading: 0 });
    if (ride?.driverLocation) {
      const prev = lastDriverPos.current;
      const heading = prev ? bearingDeg(prev, { lat: ride.driverLocation.lat, lng: ride.driverLocation.lng }) : 0;
      list.push({ id: "driver", lat: ride.driverLocation.lat, lng: ride.driverLocation.lng, kind: "driver", heading, vehicle: ride.driver?.vehicle, vehicleImageUrl: movingVehiclePhoto?.url });
    }
    return list;
  }, [nearby, pickup, dest, ride, stage, movingVehiclePhoto]);

  const fitKey = `${stage}:${ride?.id ?? ""}`;
  const progressStep = ride ? STATUS_META[ride.status].step : 0;

  /* -------------------------------- render -------------------------------- */

  return (
    <main className="relative h-screen w-full overflow-hidden bg-night-950">
      <Toaster />
      <div className="absolute inset-0 z-0">
        <MapView
          center={pickup ?? FALLBACK_CENTER}
          markers={markers}
          route={ride ? (ride.status === "IN_PROGRESS" ? ride.routeLine : ride.approachRouteLine) : null}
          onMapClick={handleMapClick}
          fitKey={fitKey}
        />
      </div>

      {/* top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[1001] flex items-center justify-between p-3 sm:p-4">
        <div className="pointer-events-auto glass flex items-center gap-3 rounded-xl px-3.5 py-2">
          <Wordmark compact />
        </div>
        <div className="pointer-events-auto glass flex items-center gap-2 rounded-xl px-2.5 py-1.5">
          <Avatar name={user.name} size={28} />
          <span className="hidden text-sm font-semibold text-slate-200 sm:block">{user.name.split(" ")[0]}</span>
          <button onClick={toggleHistory} aria-pressed={showHistory} className="ml-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-pulse-300 hover:bg-pulse-500/10">
            {showHistory ? "Close" : "History"}
          </button>
          <button onClick={togglePayments} aria-pressed={showPayments} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-nova-300 hover:bg-nova-500/10">
            Payments
          </button>
          <button onClick={logout} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-slate-200">
            Sign out
          </button>
        </div>
      </header>

      {clickMode ? (
        <div className="absolute left-1/2 top-16 z-[1001] -translate-x-1/2">
          <div className="glass flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-slate-200">
            Tap the map to set your <strong>{clickMode}</strong>
            <button onClick={() => setClickMode(null)} className="rounded-lg px-2 py-0.5 text-xs font-bold text-stop-400 hover:bg-stop-500/10">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* side panel */}
      <section
        aria-label="Ride panel"
        className="glass absolute inset-x-0 bottom-0 z-[1000] max-h-[68vh] overflow-y-auto rounded-t-2xl p-4 sm:inset-auto sm:bottom-4 sm:left-4 sm:top-16 sm:max-h-none sm:w-[400px] sm:rounded-2xl sm:p-5"
      >
        {showHistory ? (
          <HistoryPanel
            history={history}
            error={historyError}
            onRetry={loadHistory}
            onClose={() => setShowHistory(false)}
          />
        ) : showPayments ? (
          <PaymentsPanel
            history={history}
            error={historyError}
            onRetry={loadHistory}
            onClose={() => setShowPayments(false)}
          />
        ) : stage === "plan" || stage === "estimate" ? (
          <PlanPanel
            pickup={pickup}
            dest={dest}
            estimate={estimate}
            estimating={estimating}
            requesting={requesting}
            selectedClass={selectedClass}
            nearbyCount={nearby.length}
            onPickupText={(address) => setPickup((p) => (p ? { ...p, address } : p))}
            onDestText={(address) => setDest((d) => (d ? { ...d, address } : d))}
            onPinPickup={() => setClickMode("pickup")}
            onPinDestination={() => setClickMode("destination")}
            onQuickPlace={(place) => setDest({ lat: place.lat, lng: place.lng, address: place.name })}
            onUseCurrentLocation={() =>
              navigator.geolocation?.getCurrentPosition(
                (pos) => setPickup({ lat: pos.coords.latitude, lng: pos.coords.longitude, address: "Current location" }),
                () => toast("Could not access location — using Malamulele town centre", "warn"),
              )
            }
            onSelectClass={setSelectedClass}
            onEstimate={getEstimate}
            onRequest={requestRide}
            onReset={() => {
              setEstimate(null);
              setDest(null);
            }}
          />
        ) : stage === "searching" ? (
          <SearchingPanel seconds={searchSeconds} candidates={nearby.length} onCancel={() => cancelRide("rider cancelled")} />
        ) : stage === "assigned" && ride ? (
          <AssignedPanel ride={ride} onSos={() => setSosOpen(true)} onContact={() => setContactOpen(true)} onCancel={() => cancelRide("rider cancelled")} />
        ) : stage === "in_progress" && ride ? (
          <InTripPanel ride={ride} progress={progressStep} onSos={() => setSosOpen(true)} onContact={() => setContactOpen(true)} />
        ) : stage === "completed" && ride ? (
          <ReceiptPanel
            ride={ride}
            ratingScore={ratingScore}
            ratingSent={ratingSent}
            onRate={setRatingScore}
            onSubmitRating={submitRating}
            onDone={finishReceipt}
          />
        ) : stage === "cancelled" && ride ? (
          <div className="mt-slide-up space-y-4 text-center">
            <p className="font-display text-lg font-bold text-slate-100">Ride cancelled</p>
            <p className="text-sm text-slate-400">
              {ride.cancelledByRole === "DRIVER" ? "Your driver had to cancel. Request a new ride when you're ready." : "You cancelled this request."}
            </p>
            <Button fullWidth onClick={finishReceipt}>
              Request a new ride
            </Button>
          </div>
        ) : (
          <LoadingState />
        )}
      </section>

      {/* modals */}
      <Modal open={sosOpen} onClose={() => setSosOpen(false)} title="Emergency assistance">
        <div className="space-y-3 text-sm text-slate-300">
          <p>If you are in immediate danger in South Africa, call the national emergency number:</p>
          <a href="tel:112" className="block rounded-xl border border-stop-500/40 bg-stop-500/10 px-4 py-3 text-center font-display text-xl font-bold text-stop-400">
            Call 112
          </a>
          <p className="text-xs text-slate-500">
            Your trip, driver and route are recorded. MALTown safety response integration ships post-MVP.
          </p>
        </div>
      </Modal>
      <Modal open={contactOpen} onClose={() => setContactOpen(false)} title="Contact your driver">
        {ride?.driver ? (
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              Call <strong>{ride.driver.name.split(" ")[0]}</strong> directly:
            </p>
            <a href={`tel:${ride.driver.phone}`} className="block rounded-xl border border-pulse-500/40 bg-pulse-500/10 px-4 py-3 text-center font-display text-lg font-bold text-pulse-300">
              {ride.driver.phone}
            </a>
            <p className="text-xs text-slate-500">In-app messaging is designed into the notification architecture and ships post-MVP.</p>
          </div>
        ) : null}
      </Modal>
    </main>
  );
}

/* --------------------------------- panels ---------------------------------- */

function PlanPanel(props: {
  pickup: GeoPoint | null;
  dest: GeoPoint | null;
  estimate: EstimateResponse | null;
  estimating: boolean;
  requesting: boolean;
  selectedClass: VehicleClassId;
  nearbyCount: number;
  onPickupText: (v: string) => void;
  onDestText: (v: string) => void;
  onPinPickup: () => void;
  onPinDestination: () => void;
  onQuickPlace: (p: { name: string; lat: number; lng: number }) => void;
  onUseCurrentLocation: () => void;
  onSelectClass: (c: VehicleClassId) => void;
  onEstimate: () => void;
  onRequest: () => void;
  onReset: () => void;
}) {
  const { pickup, dest, estimate } = props;
  const selectedFare = estimate?.options.find((o) => o.classId === props.selectedClass);

  return (
    <div className="mt-slide-up space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold text-slate-50">Where to, {""}
          <span className="text-pulse-400">boss?</span>
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">{props.nearbyCount} drivers online near you</p>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full border-[3px] border-go-400 bg-night-900" aria-hidden />
          <input
            className="input-base"
            value={pickup?.address ?? ""}
            placeholder="Pickup location"
            onChange={(e) => props.onPickupText(e.target.value)}
            aria-label="Pickup address"
          />
          <button onClick={props.onPinPickup} className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10">
            Pin
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rotate-45 bg-nova-400" aria-hidden />
          <input
            className="input-base"
            value={dest?.address ?? ""}
            placeholder="Where are you going?"
            onChange={(e) => props.onDestText(e.target.value)}
            aria-label="Destination address"
          />
          <button onClick={props.onPinDestination} className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10">
            Pin
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={props.onUseCurrentLocation} className="rounded-full border border-pulse-500/30 bg-pulse-500/10 px-3 py-1 text-[11px] font-semibold text-pulse-300 hover:bg-pulse-500/20">
            ⌖ Use current location
          </button>
          {PLACES.slice(0, 4).map((p) => (
            <button key={p.name} onClick={() => props.onQuickPlace(p)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-400 hover:border-pulse-500/40 hover:text-pulse-300">
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <section aria-label="Payment method" className="glass-soft space-y-2 rounded-xl px-3.5 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-200">Payment</p>
          <Badge tone="accent">Cash available</Badge>
        </div>
        <p className="text-xs text-slate-400">Pay your driver in cash after the ride. Card and mobile money are coming soon.</p>
      </section>

      {!estimate ? (
        <Button fullWidth size="lg" disabled={!pickup || !dest} loading={props.estimating} onClick={props.onEstimate}>
          Get fare estimate
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              {estimate.distanceKm.toFixed(1)} km · ~{Math.round(estimate.durationMin)} min · {estimate.onlineDriversNearby} drivers in range
            </span>
            <button onClick={props.onReset} className="font-semibold text-pulse-300 hover:text-pulse-200">
              Edit
            </button>
          </div>
          <div role="radiogroup" aria-label="Vehicle class" className="space-y-2">
            {estimate.options.map((opt) => {
              const active = props.selectedClass === opt.classId;
              return (
                <button
                  key={opt.classId}
                  role="radio"
                  aria-checked={active}
                  onClick={() => props.onSelectClass(opt.classId)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left transition ${
                    active ? "border-pulse-500/60 bg-pulse-500/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-bold text-slate-100">{opt.name}</span>
                    <span className="block text-[11px] text-slate-500">
                      {opt.description} · {opt.seats} {opt.seats === 1 ? "seat" : "seats"}
                    </span>
                  </span>
                  <span className={`font-display text-base font-bold tabular-nums ${active ? "text-pulse-300" : "text-slate-300"}`}>
                    {formatZAR(opt.fare.total)}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedFare ? (
            <details className="glass-soft rounded-xl px-4 py-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Fare breakdown
              </summary>
              <div className="mt-3">
                <FareBreakdownView fare={selectedFare.fare} />
              </div>
            </details>
          ) : null}
          <p className="text-center text-[11px] text-slate-500">Pickup ETA ≈ {estimate.etaToPickupMin} min · quotes are final, computed by MALTown servers</p>
          <Button fullWidth size="lg" loading={props.requesting} onClick={props.onRequest}>
            Request {selectedFare ? classLabel(selectedFare.classId) : "RiDE"} — {selectedFare ? formatZAR(selectedFare.fare.total) : ""}
          </Button>
        </div>
      )}
    </div>
  );
}

function SearchingPanel({ seconds, candidates, onCancel }: { seconds: number; candidates: number; onCancel: () => void }) {
  return (
    <div className="mt-slide-up flex flex-col items-center gap-4 py-4 text-center">
      <div className="relative flex h-28 w-28 items-center justify-center" aria-hidden>
        <span className="absolute inset-0 rounded-full border border-pulse-500/40" style={{ animation: "mt-pulse-ring 2s ease-out infinite" }} />
        <span className="absolute inset-2 rounded-full border border-pulse-500/30" style={{ animation: "mt-pulse-ring 2s ease-out 0.6s infinite" }} />
        <div className="relative grid h-16 w-16 place-items-center rounded-full bg-pulse-500/15">
          <div className="mt-radar-sweep h-12 w-12 rounded-full border-t-2 border-pulse-400" />
        </div>
      </div>
      <div>
        <p className="font-display text-lg font-bold text-slate-100">Finding your driver…</p>
        <p className="mt-1 text-sm text-slate-400">
          {candidates > 0 ? `${candidates} nearby driver${candidates > 1 ? "s" : ""} notified` : "Broadcasting to the network"} · {seconds}s
        </p>
      </div>
      <Button variant="danger" onClick={onCancel}>
        Cancel request
      </Button>
    </div>
  );
}

function AssignedPanel({ ride, onSos, onContact, onCancel }: { ride: RideDto; onSos: () => void; onContact: () => void; onCancel: () => void }) {
  const meta = STATUS_META[ride.status];
  return (
    <div className="mt-slide-up space-y-4">
      <div className="flex items-center justify-between">
        <StatusPill status={ride.status} />
        <span className="text-xs text-slate-500">{formatZAR(ride.estFare)} · {ride.distanceKm.toFixed(1)} km</span>
      </div>
      {ride.driver ? <DriverInfoPanel driver={ride.driver} /> : null}
      <p className="rounded-xl bg-white/[0.04] px-3.5 py-2.5 text-sm text-slate-300">
        {ride.status === "DRIVER_ARRIVED" ? "Your driver is at the pickup point." : "Your driver is heading to you. Track them live on the map."}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="ghost" size="sm" onClick={onContact}>
          Call
        </Button>
        <Button variant="ghost" size="sm" onClick={onContact}>
          Message
        </Button>
        <Button variant="danger" size="sm" onClick={onSos}>
          SOS
        </Button>
      </div>
      <button onClick={onCancel} className="w-full text-center text-xs font-semibold text-slate-500 hover:text-stop-400">
        Cancel ride
      </button>
      <p className="sr-only" aria-live="polite">
        {meta.label}
      </p>
    </div>
  );
}

function InTripPanel({ ride, progress, onSos, onContact }: { ride: RideDto; progress: number; onSos: () => void; onContact: () => void }) {
  const pct = Math.min(100, Math.round((progress / 6) * 100));
  return (
    <div className="mt-slide-up space-y-4">
      <div className="flex items-center justify-between">
        <StatusPill status="IN_PROGRESS" />
        <span className="text-xs text-slate-500">≈ {Math.max(1, Math.round(ride.durationMin))} min</span>
      </div>
      <div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-pulse-500 to-nova-500 transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-slate-300">
          En route to <strong className="text-slate-100">{ride.destination.address}</strong>
        </p>
      </div>
      {ride.driver ? <DriverInfoPanel driver={ride.driver} /> : null}
      <div className="grid grid-cols-3 gap-2">
        <Button variant="ghost" size="sm" onClick={onContact}>
          Call
        </Button>
        <Button variant="ghost" size="sm" onClick={onContact}>
          Message
        </Button>
        <Button variant="danger" size="sm" onClick={onSos}>
          SOS
        </Button>
      </div>
      <p className="text-center text-[11px] text-slate-500">Fare locked at {formatZAR(ride.estFare)}</p>
    </div>
  );
}

function ReceiptPanel({
  ride,
  ratingScore,
  ratingSent,
  onRate,
  onSubmitRating,
  onDone,
}: {
  ride: RideDto;
  ratingScore: number;
  ratingSent: boolean;
  onRate: (v: number) => void;
  onSubmitRating: () => void;
  onDone: () => void;
}) {
  return (
    <div className="mt-slide-up space-y-4">
      <div className="text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-go-500/15 text-go-400" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="mt-2 font-display text-xl font-bold text-slate-50">You&apos;ve arrived!</h2>
        <p className="text-sm text-slate-400">
          {ride.pickup.address} → {ride.destination.address}
        </p>
      </div>

      <GlassCard className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Final fare</span>
          <span className="font-display text-2xl font-bold text-pulse-400 tabular-nums">{formatZAR(ride.finalFare ?? ride.estFare)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{ride.distanceKm.toFixed(1)} km · {Math.round(ride.durationMin)} min · {classLabel(ride.vehiclePref)}</span>
          {ride.payment ? <Badge tone={ride.payment.provider === "MOCK" ? "warn" : ride.payment.status === "SUCCESS" ? "success" : "danger"}>{paymentMethodLabel(ride.payment.method)} · {ride.payment.provider === "MOCK" ? "Demo record" : ride.payment.status}</Badge> : null}
        </div>
      </GlassCard>

      {!ratingSent ? (
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold text-slate-300">Rate {ride.driver?.name.split(" ")[0] ?? "your driver"}</p>
          <div className="flex justify-center">
            <Stars value={ratingScore} onChange={onRate} size={30} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={onDone}>
              Skip
            </Button>
            <Button disabled={ratingScore === 0} onClick={onSubmitRating}>
              Submit
            </Button>
          </div>
        </div>
      ) : (
        <Button fullWidth variant="success" onClick={onDone}>
          Done — request another ride
        </Button>
      )}
    </div>
  );
}

function HistoryPanel({
  history,
  error,
  onRetry,
  onClose,
}: {
  history: RideDto[] | null;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="mt-slide-up space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-slate-100">Your trips</h2>
        <button onClick={onClose} className="text-xs font-semibold text-pulse-300 hover:text-pulse-200">
          Back to ride
        </button>
      </div>
      {error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : history === null ? (
        <LoadingState label="Loading trips…" />
      ) : history.length === 0 ? (
        <div className="py-4">
          <p className="text-sm text-slate-400">No completed trips yet — your journeys will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {history.map((r) => (
            <RideHistoryCard key={r.id} ride={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function paymentMethodLabel(method: PaymentMethod): string {
  if (method === "MOBILE_MONEY") return "Mobile money";
  return method === "CASH" ? "Cash" : "Card";
}

function PaymentsPanel({
  history,
  error,
  onRetry,
  onClose,
}: {
  history: RideDto[] | null;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  const payments = (history ?? [])
    .flatMap((ride) => (ride.payment ? [{ ride, payment: ride.payment }] : []))
    .sort((a, b) => Date.parse(b.payment.createdAt) - Date.parse(a.payment.createdAt));

  return (
    <div className="mt-slide-up space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-slate-100">Payments & receipts</h2>
        <button onClick={onClose} className="text-xs font-semibold text-pulse-300 hover:text-pulse-200">
          Back to ride
        </button>
      </div>
      <GlassCard className="space-y-1.5 p-3.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-200">Available payment method</p>
          <Badge tone="accent">Cash</Badge>
        </div>
        <p className="text-xs leading-relaxed text-slate-400">Pay your driver directly after the trip. Card and mobile-money payments are not available yet.</p>
      </GlassCard>
      {error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : history === null ? (
        <LoadingState label="Loading payments…" />
      ) : payments.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-sm text-slate-400">No payment records yet.</p>
          <p className="mt-1 text-xs text-slate-500">Completed trip receipts will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {payments.map(({ ride, payment }: { ride: RideDto; payment: PaymentDto }) => {
            const demo = payment.provider === "MOCK";
            const tone = demo ? "warn" : payment.status === "SUCCESS" ? "success" : payment.status === "PENDING" ? "info" : "danger";
            const when = new Date(payment.createdAt);
            return (
              <article key={payment.id} className="glass-soft space-y-2 rounded-xl p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-200">{ride.pickup.address} → {ride.destination.address}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {when.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <span className="shrink-0 font-display text-base font-bold tabular-nums text-pulse-300">{formatZAR(payment.amount)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="accent">{paymentMethodLabel(payment.method)}</Badge>
                  <Badge tone={tone}>{demo ? "Demo record" : payment.status}</Badge>
                </div>
                {demo ? <p className="text-[11px] text-slate-500">Demo payment status; cash collection is not verified by the app.</p> : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
