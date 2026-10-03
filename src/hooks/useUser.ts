"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { UserDto, UserRole, VehicleDto } from "@/lib/types";

export function roleHome(role: UserRole): string {
  if (role === "ADMIN") return "/admin";
  if (role === "DRIVER") return "/driver";
  return "/rider";
}

interface MeResponse {
  user: UserDto;
  driver?: {
    isOnline: boolean;
    rating: number;
    totalTrips: number;
    totalEarnings: number;
    verificationStatus: string;
  };
  vehicle?: VehicleDto | null;
}

export interface UseUserState {
  user: UserDto | null;
  driver: MeResponse["driver"];
  vehicle: VehicleDto | null | undefined;
  loading: boolean;
}

/** Loads the session user; redirects to /login or the right home by role. */
export function useUser(requiredRole?: UserRole): UseUserState {
  const [state, setState] = useState<UseUserState>({
    user: null,
    driver: undefined,
    vehicle: undefined,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    api<MeResponse>("/users/me")
      .then((data) => {
        if (!active) return;
        if (requiredRole && data.user.role !== requiredRole) {
          window.location.href = roleHome(data.user.role);
          return;
        }
        setState({ user: data.user, driver: data.driver, vehicle: data.vehicle ?? null, loading: false });
      })
      .catch((err) => {
        if (!active) return;
        if (err?.status === 401) {
          window.location.href = "/login";
          return;
        }
        setState((s) => ({ ...s, loading: false }));
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
