"use client";

import { useEffect, useState } from "react";

export interface VehicleImage {
  url: string;
  sourceUrl: string;
  title: string;
  artist: string;
  license: string;
  licenseUrl: string;
}

const imageRequests = new Map<string, Promise<VehicleImage | null>>();

function fetchVehicleImage(make: string, model: string): Promise<VehicleImage | null> {
  const key = `${make.toLowerCase()}:${model.toLowerCase()}`;
  let request = imageRequests.get(key);
  if (!request) {
    const params = new URLSearchParams({ make, model });
    request = fetch(`/api/vehicles/image?${params}`)
      .then(async (response) => response.ok ? (await response.json() as { image: VehicleImage | null }).image : null)
      .catch(() => null);
    imageRequests.set(key, request);
  }
  return request;
}

export function useVehicleImage(make?: string, model?: string): VehicleImage | null {
  const [image, setImage] = useState<VehicleImage | null>(null);

  useEffect(() => {
    if (!make || !model || make === "Other" || model.toLowerCase().includes("other")) {
      setImage(null);
      return;
    }
    let active = true;
    void fetchVehicleImage(make, model).then((result) => {
      if (active) setImage(result);
    });
    return () => { active = false; };
  }, [make, model]);

  return image;
}