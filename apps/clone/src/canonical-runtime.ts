import type { EdexSatelliteLocation } from "./edex-assets.js";

export type MemoryPointState = "active" | "available" | "free";

const memoryPointEncoding = [
  "FAVAAFFFAFFAVAFFAFAFVAAVAAAFAVAAFAFFVAAAVFAAAAAVVVFAFFFAAFAAAAFFAAFAVVFFVAAAAFAA",
  "VAAAFVFAAFAVVFVAAAFAFVFFAVAFAFAAAFAVVAAFAAVFAAFAVVFAAAFFVVAAAAAFAAAFAFAFAAVFAFFA",
  "FVVAAAAFVVVFAAVVAAAAFVVAFFFAVFFAAFVVAFFFVFVFVFVAVVAFAVAFFAFAAAAAVVFAFFAFVFAAFFFF",
  "AVAVAFFAFAFAAAFAAAVFAAAAVFFAAAVFVAAFVVVVAVFAAAFFAAAFVFVVAAAAFFFFAFFAFVFVFFFFFAVF",
  "AVFFAFFFAFAFAFFVFFAAVVAAAVFFAFAVFFFFFFFVFAFFAFVVFFAAAVAVFAFFFAVFAVFFFFAAAFVAAFAF",
  "AAFFAAVAVAFVFAVVVAAVAFFFAVAAVFAAAAAAAFAF"
].join("");

if (memoryPointEncoding.length !== 440) throw new Error("Canonical eDEX memory point map must contain 440 samples");

const memoryPointLegend: Record<string, MemoryPointState> = {
  A: "active",
  V: "available",
  F: "free"
};

export const canonicalMemoryPointStates = [...memoryPointEncoding].map((sample) => memoryPointLegend[sample]!);

export const canonicalCpuTraces = {
  first: "0,36.3 10,36.9 20,30.7 30,3.4 40,26.6 50,30.8 60,25.6 70,16.2 80,22.4 90,33.1 100,36.5 110,36.5 120,38.3 130,41.7 140,32.3 150,31.3 160,29.8 170,29.8 180,39.5 190,40.3 200,35.5 210,35.5 220,42.7 230,39.3 240,35.1 250,28 260,22.4 270,21 280,22",
  firstSecondary: "0,36.3 10,36.9 20,28.7 30,3.4 40,26.6 50,30.8 60,25.6 70,18.2 80,22.4 90,33.1 100,36.5 110,36.5 120,38.3 130,41.7 140,32.3 150,31.3 160,29.8 170,29.8 180,36.5 190,40.3 200,35.5 210,35.5 220,42.7 230,39.3 240,35.1 250,27 260,22.4 270,21 280,22",
  second: "0,34.6 10,37 20,33.2 30,6.3 40,25 50,30.8 60,27.6 70,16.5 80,20.3 90,30.2 100,35.4 110,35.4 120,36.8 130,39.2 140,30.2 150,29.8 160,28.4 170,28.4 180,36.8 190,40.6 200,34.4 210,35.4 220,40.6 230,36.8 240,33 250,29 260,21.7 270,19.9 280,21.9",
  secondSecondary: "0,34.6 10,37 20,33.2 30,6.3 40,25 50,30.8 60,27.6 70,17.5 80,20.3 90,31.2 100,35.4 110,35.4 120,36.8 130,39.2 140,30.2 150,29.8 160,28.4 170,28.4 180,36.8 190,40.6 200,34.4 210,35.4 220,40.6 230,36.8 240,33 250,29 260,21.7 270,19.9 280,21.9"
} as const;

export const canonicalNetworkTraces = {
  outbound: "0,98 12,90 24,78 36,82 48,92 60,93 72,93 84,99 96,96 108,96 120,97 132,97 144,97 156,97 168,93 180,93 192,99 204,101 216,100 228,97 240,95 252,97 264,98 276,98 280,96",
  inbound: "0,116 3,115 12,138 24,183 36,171 48,147 60,141 72,129 84,99 96,112 108,109 120,109 132,109 144,105 156,107 168,121 180,116 192,104 204,114 216,107 228,107 240,111 252,109 264,102 276,102 280,112"
} as const;

/**
 * Deterministic replacement for the live peer geolocation snapshot visible in
 * the canonical capture. The upstream LocationGlobe creates these with
 * Globe.addPin; keeping them as coordinates preserves that rendering path.
 */
export const canonicalNetworkConnectionLocations = [
  { latitude: 78, longitude: 153 },
  { latitude: 37, longitude: -114 },
  { latitude: 40, longitude: -139 },
  { latitude: -14, longitude: 156 }
] as const;

/**
 * Static capture counterpart of LocationGlobe's six generated satellites.
 * Their longitude bands and ENCOM rendering path remain upstream-native; the
 * recorded coordinates remove the random startup drift from visual checks.
 */
export const canonicalGlobeConstellation = [
  { lat: -15.984088151017204, lon: -120, altitude: 1.545638604834676 },
  { lat: -26.507263955427334, lon: 0, altitude: 1.4334829842671752 },
  { lat: -15, lon: 120, altitude: 1.55 },
  { lat: 20.239963853964582, lon: -90, altitude: 1.550001066364348 },
  { lat: 31.978148951893672, lon: 30, altitude: 1.4846712108701468 },
  { lat: 36, lon: 150, altitude: 1.36 }
] as const satisfies ReadonlyArray<EdexSatelliteLocation>;
