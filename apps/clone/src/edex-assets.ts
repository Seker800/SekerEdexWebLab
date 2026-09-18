export interface EdexIcon {
  width: number | string | null;
  height: number | string | null;
  svg: string;
}

export type EdexIconSet = Record<string, EdexIcon>;

export async function loadEdexIcons(): Promise<EdexIconSet> {
  const response = await fetch("/icons/edex-file-icons.json");
  if (!response.ok) throw new Error(`Unable to load upstream eDEX icons (${response.status})`);
  return response.json() as Promise<EdexIconSet>;
}

export function renderEdexIcon(icons: EdexIconSet, name: string): string {
  const icon = icons[name] ?? icons.file;
  if (!icon) throw new Error(`Missing upstream eDEX icon: ${name}`);
  const width = Number(icon.width) || 512;
  const height = Number(icon.height) || 512;
  return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">${icon.svg}</svg>`;
}

interface EncomGlobeInstance {
  domElement: HTMLCanvasElement;
  cameraAngle: number;
  lastRenderDate?: Date;
  init(background: string, onReady: () => void): void;
  tick(): void;
  addMarker(latitude: number, longitude: number, label: string, connected?: boolean): unknown;
  addPin(latitude: number, longitude: number, label: string, scale?: number): unknown;
  addConstellation(points: Array<{ lat: number; lon: number; altitude: number }>): unknown;
  satellites: Record<string, { animator?: { update(milliseconds: number): void } }>;
}

interface EncomGlobeConstructor {
  new(width: number, height: number, options: Record<string, unknown>): EncomGlobeInstance;
}

export interface EdexGlobeLayers {
  satellites: boolean;
  localEndpoint: boolean;
  connections: boolean;
}

export interface EdexSatelliteLocation {
  lat: number;
  lon: number;
  altitude: number;
}

export interface EdexGlobeOptions {
  animate: boolean;
  fixedCameraAngle?: number;
  fixedRandomSeed?: number;
  connectionLocations?: ReadonlyArray<{ latitude: number; longitude: number }>;
  layers?: EdexGlobeLayers;
  constellationLocations?: ReadonlyArray<EdexSatelliteLocation>;
  sourceTimingScale?: number;
  fixedSatelliteAnimationAdvanceMs?: number;
  runAnimation?: (callback: () => void) => void;
}

const allGlobeLayers: EdexGlobeLayers = {
  satellites: true,
  localEndpoint: true,
  connections: true
};

declare global {
  interface Window {
    ENCOM?: { Globe: EncomGlobeConstructor };
  }
}

export async function initializeEdexGlobe(
  container: HTMLElement,
  options: EdexGlobeOptions
): Promise<boolean> {
  const {
    animate,
    fixedCameraAngle,
    fixedRandomSeed = 0x22e2d8,
    connectionLocations = [],
    layers = allGlobeLayers,
    constellationLocations,
    sourceTimingScale = 1,
    fixedSatelliteAnimationAdvanceMs = 0,
    runAnimation
  } = options;
  const Globe = window.ENCOM?.Globe;
  if (!Globe) return false;
  const runtimeStartedAt = performance.now();
  const response = await fetch("/grid.json");
  if (!response.ok) return false;
  const grid = await response.json() as { tiles: unknown[] };
  if (animate) {
    const sourceConstructionDelay = Math.max(1, Math.round(2_000 * sourceTimingScale));
    await new Promise<void>((resolve) => window.setTimeout(resolve, Math.max(1, sourceConstructionDelay - (performance.now() - runtimeStartedAt))));
  }
  const bounds = container.getBoundingClientRect();
  const width = Math.max(220, Math.round(bounds.width));
  const height = Math.max(220, Math.round(bounds.height));
  const nativeRandom = Math.random;
  let randomState = fixedRandomSeed >>> 0;
  if (fixedCameraAngle !== undefined) {
    Math.random = () => {
      randomState = (1664525 * randomState + 1013904223) >>> 0;
      return randomState / 0x1_0000_0000;
    };
  }
  let globe: EncomGlobeInstance;
  try {
    globe = new Globe(width, height, {
      font: "United Sans",
      data: [],
      tiles: grid.tiles,
      baseColor: "#000000",
      markerColor: "#aacfd1",
      pinColor: "#aacfd1",
      satelliteColor: "#aacfd1",
      scale: 1.1,
      viewAngle: 0.63,
      dayLength: 45_000,
      introLinesDuration: animate ? 2_000 : 1,
      introLinesColor: "#aacfd1",
      maxPins: 300,
      maxMarkers: 100
    });
    container.replaceChildren(globe.domElement);
    const initialized = new Promise<void>((resolve) => globe.init("#05080d", resolve));
    const addSatellites = (): void => {
      if (!layers.satellites) return;
      const generatedConstellation: EdexSatelliteLocation[] = [];
      for (let latitudeBand = 0; latitudeBand < 2; latitudeBand += 1) {
        for (let longitudeBand = 0; longitudeBand < 3; longitudeBand += 1) {
          generatedConstellation.push({
            lat: 50 * latitudeBand - 30 + 15 * Math.random(),
            lon: 120 * longitudeBand - 120 + 30 * latitudeBand,
            altitude: Math.random() * .4 + 1.3
          });
        }
      }
      globe.addConstellation(constellationLocations ? [...constellationLocations] : generatedConstellation);
    };
    if (animate) addSatellites();
    await initialized;
    if (!animate) addSatellites();
  } finally {
    Math.random = nativeRandom;
  }
  if (fixedCameraAngle !== undefined) {
    globe.cameraAngle = fixedCameraAngle;
    globe.lastRenderDate = new Date();
  }
  const addRuntimePins = (): void => {
    if (layers.localEndpoint) {
      globe.addPin(-42.8987, 1.2674, "", 1.2);
      globe.addMarker(-42.8987, 1.2674, "", false);
    }
    if (layers.connections) {
      connectionLocations.forEach(({ latitude, longitude }) => {
        globe.addPin(latitude, longitude, "", 1.2);
      });
    }
    container.dataset.globeLayers = Object.entries(layers).filter(([, enabled]) => enabled).map(([name]) => name).join(",") || "base";
    container.dataset.globePinsReady = "true";
  };
  if (animate) {
    const sourcePinDelay = Math.max(1, Math.round(4_000 * sourceTimingScale));
    window.setTimeout(addRuntimePins, Math.max(1, sourcePinDelay - (performance.now() - runtimeStartedAt)));
  } else {
    addRuntimePins();
  }
  const advanceFrame = (): Promise<void> => new Promise((resolve) => {
    window.requestAnimationFrame(() => { globe.tick(); resolve(); });
  });
  for (let frameIndex = 0; frameIndex < (animate ? 2 : 42); frameIndex += 1) await advanceFrame();
  if (!animate && fixedSatelliteAnimationAdvanceMs > 0) {
    Object.values(globe.satellites).find((satellite) => satellite.animator)?.animator?.update(fixedSatelliteAnimationAdvanceMs);
    globe.lastRenderDate = new Date();
    globe.tick();
  }
  if (animate) {
    if (runAnimation) runAnimation(() => globe.tick());
    else {
      const frame = (): void => {
        globe.tick();
        window.requestAnimationFrame(frame);
      };
      window.requestAnimationFrame(frame);
    }
  }
  container.dataset.globeReady = "true";
  return true;
}
