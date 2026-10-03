/** Local market defaults for the Malamulele pilot. Coordinates are WGS84. */
export const MARKET_CENTER = {
  lat: -23.002718,
  lng: 30.6946597,
  address: "Malamulele town centre",
};

/** Nearby village landmarks used as quick destinations in the rider app. */
export const MARKET_LANDMARKS = [
  { name: "Malamulele town centre", lat: MARKET_CENTER.lat, lng: MARKET_CENTER.lng },
  { name: "Xigalo Village", lat: -22.9369282, lng: 30.7204003 },
  { name: "Ka-Mhinga Village", lat: -22.7669444, lng: 30.9011111 },
] as const;