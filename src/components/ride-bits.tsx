"use client";

import { Avatar, Badge, StatusPill } from "@/components/ui";
import { VehicleArtwork } from "@/components/vehicle-artwork";
import {
  formatZAR,
  STATUS_META,
  VEHICLE_CLASSES,
  type DriverInfoDto,
  type FareBreakdown,
  type RideDto,
} from "@/lib/types";

export function classLabel(pref: string): string {
  return VEHICLE_CLASSES.find((c) => c.id === pref)?.name ?? pref;
}

export function FareBreakdownView({ fare }: { fare: FareBreakdown }) {
  const rows: Array<[string, string]> = [
    ["Base fare", formatZAR(fare.base)],
    [`Distance (${fare.distanceKm.toFixed(1)} km)`, formatZAR(fare.distanceCost)],
    [`Time (${Math.round(fare.durationMin)} min)`, formatZAR(fare.timeCost)],
    ["Booking fee", formatZAR(fare.bookingFee)],
  ];
  return (
    <div className="space-y-1.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between text-slate-400">
          <span>{label}</span>
          <span className="tabular-nums text-slate-300">{value}</span>
        </div>
      ))}
      <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
        <span className="font-semibold text-slate-200">Total</span>
        <span className="font-display text-lg font-bold text-pulse-400 tabular-nums">{formatZAR(fare.total)}</span>
      </div>
    </div>
  );
}

export function DriverInfoPanel({ driver }: { driver: DriverInfoDto }) {
  const vehicleLine = driver.vehicle
    ? `${driver.vehicle.color} ${driver.vehicle.make} ${driver.vehicle.model} · ${driver.vehicle.registration}`
    : "Vehicle on file";
  return (
    <div className="flex items-center gap-3">
      <Avatar name={driver.name} size={52} />
      {driver.vehicle ? <VehicleArtwork {...driver.vehicle} compact /> : null}
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-base font-bold text-slate-100">{driver.name}</p>
        <p className="truncate text-xs text-slate-400">{vehicleLine}</p>
        <div className="mt-1 flex items-center gap-2">
          <Badge tone="accent">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <path d="M6 0.8l1.55 3.14 3.46.5-2.5 2.44.59 3.45L6 8.7l-3.1 1.63.59-3.45-2.5-2.44 3.46-.5L6 0.8z" />
            </svg>
            {driver.rating.toFixed(2)}
          </Badge>
          <span className="text-[11px] text-slate-500">{driver.totalTrips} trips</span>
        </div>
      </div>
    </div>
  );
}

export function Stars({
  value,
  onChange,
  size = 26,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-1" role={onChange ? "radiogroup" : undefined} aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= value;
        const star = (
          <svg width={size} height={size} viewBox="0 0 12 12" fill={active ? "#FBBF24" : "none"} stroke={active ? "#FBBF24" : "#475569"} strokeWidth="1" aria-hidden>
            <path d="M6 0.8l1.55 3.14 3.46.5-2.5 2.44.59 3.45L6 8.7l-3.1 1.63.59-3.45-2.5-2.44 3.46-.5L6 0.8z" />
          </svg>
        );
        return onChange ? (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => onChange(n)}
            className="rounded p-0.5 transition-transform hover:scale-110"
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </div>
  );
}

export function RideHistoryCard({ ride }: { ride: RideDto }) {
  const meta = STATUS_META[ride.status];
  const when = new Date(ride.requestedAt);
  return (
    <div className="glass-soft rounded-xl p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-200">{ride.pickup.address}</p>
          <p className="truncate text-sm text-slate-400">→ {ride.destination.address}</p>
        </div>
        <StatusPill status={ride.status} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>
          {when.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ·{" "}
          {when.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </span>
        <span className="font-semibold tabular-nums text-slate-300">
          {ride.finalFare != null ? formatZAR(ride.finalFare) : ride.status === "CANCELLED" ? "—" : formatZAR(ride.estFare)}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-slate-600">{meta.label} · {ride.distanceKm.toFixed(1)} km · {classLabel(ride.vehiclePref)}</p>
    </div>
  );
}
