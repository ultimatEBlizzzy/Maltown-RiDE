"use client";

import { vehicleColorHex } from "@/lib/vehicle-catalog";
import type { VehicleType } from "@/lib/types";
import { useVehicleImage } from "@/hooks/useVehicleImage";

interface VehicleArtworkProps {
  make: string;
  model: string;
  color: string;
  vehicleType: VehicleType;
  compact?: boolean;
}

export function VehicleArtwork({ make, model, color, vehicleType, compact = false }: VehicleArtworkProps) {
  const paint = vehicleColorHex(color);
  const label = `${color} ${make} ${model}`;
  const photo = useVehicleImage(make, model);

  return (
    <div className={`overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] ${compact ? "p-2" : "p-3"}`}>
      {photo ? (
        <>
          <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="block">
            <img src={photo.url} alt={`${photo.title || label}; ${photo.license} by ${photo.artist}`} className={`mx-auto block rounded-lg object-cover ${compact ? "h-12 w-24" : "h-24 w-full"}`} />
          </a>
          <p className={`mt-1 truncate text-center text-slate-500 ${compact ? "text-[8px]" : "text-[10px]"}`}>
            <a href={photo.licenseUrl} target="_blank" rel="noreferrer" title={`Photo by ${photo.artist}; ${photo.license}`} className="underline">
              Photo: {photo.artist} · {photo.license}
            </a>
          </p>
        </>
      ) : (
      <svg viewBox="0 0 180 100" role="img" aria-label={label} className={`mx-auto block ${compact ? "h-12 w-24" : "h-24 w-full"}`}>
        <ellipse cx="90" cy="79" rx="67" ry="8" fill="#030712" opacity="0.45" />
        {vehicleType === "MOTO" ? (
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="47" cy="69" r="15" stroke="#cbd5e1" strokeWidth="5" />
            <circle cx="132" cy="69" r="15" stroke="#cbd5e1" strokeWidth="5" />
            <path d="M47 69 67 48 88 69 108 69 132 69 113 44 94 44" stroke={paint} strokeWidth="8" />
            <path d="M61 43h17m30 0 11-10m-56 36h26" stroke="#e2e8f0" strokeWidth="4" />
            <path d="M78 45 93 43 108 51 98 60 80 58Z" fill={paint} stroke="#0f172a" strokeWidth="2" />
          </g>
        ) : (
          <g>
            {vehicleType === "MINIBUS" ? (
              <>
                <path d="M24 68V40Q24 31 35 29H141Q153 30 157 40L164 58V69H24Z" fill={paint} stroke="#101827" strokeWidth="3" />
                <path d="M36 35h27v20H34Zm33 0h26v20H69Zm32 0h24v20h-24Zm30 2h9l8 18h-17Z" fill="#b8d8ee" opacity="0.82" />
              </>
            ) : vehicleType === "SUV" ? (
              <>
                <path d="M22 68 27 47Q29 41 39 39L54 25Q58 21 67 21H119Q128 21 134 30L149 41Q157 43 160 51L164 68Z" fill={paint} stroke="#101827" strokeWidth="3" />
                <path d="m59 27-13 13h34V25H67q-5 0-8 2Zm26-2v15h41l-10-13q-2-2-7-2Z" fill="#b8d8ee" opacity="0.86" />
              </>
            ) : vehicleType === "HATCHBACK" ? (
              <>
                <path d="M22 68 28 48Q31 41 42 39L57 25Q62 21 71 21H113Q123 21 132 32L148 43Q157 46 161 56L164 68Z" fill={paint} stroke="#101827" strokeWidth="3" />
                <path d="M62 26 48 40h37V24H71q-5 0-9 2Zm27-2v16h43l-11-13q-4-3-10-3Z" fill="#b8d8ee" opacity="0.86" />
              </>
            ) : (
              <>
                <path d="M20 68 26 48Q29 41 41 39L58 26Q63 22 73 22H112Q122 22 132 32L150 42Q158 45 162 56L165 68Z" fill={paint} stroke="#101827" strokeWidth="3" />
                <path d="M63 27 49 40h37V25H73q-6 0-10 2Zm28-2v15h44l-11-12q-4-3-10-3Z" fill="#b8d8ee" opacity="0.86" />
              </>
            )}
            <path d="M25 57h136v6H25Z" fill="#0f172a" opacity="0.35" />
            <circle cx="52" cy="67" r="11" fill="#101827" /><circle cx="52" cy="67" r="5" fill="#cbd5e1" />
            <circle cx="135" cy="67" r="11" fill="#101827" /><circle cx="135" cy="67" r="5" fill="#cbd5e1" />
            <path d="M23 51h7v7h-9Zm135 1 7 4v4h-9Z" fill="#fef3c7" />
          </g>
        )}
      </svg>
      )}
      {!compact ? <p className="mt-1 truncate text-center text-xs font-semibold text-slate-300">{make} {model} · {color}</p> : null}
    </div>
  );
}