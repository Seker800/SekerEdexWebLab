export interface TelemetrySnapshot {
  source: "simulated";
  cpu: number;
  memory: number;
  temperature: number;
  upload: number;
  download: number;
  tasks: number;
  historyA: number[];
  historyB: number[];
}

const wave = (length: number, phase: number, center: number, amplitude: number): number[] =>
  Array.from({ length }, (_, index) => Math.round(center + Math.sin(index * 0.7 + phase) * amplitude + Math.cos(index * 0.23 + phase) * amplitude * 0.35));

export function createTelemetrySnapshot(tick: number): TelemetrySnapshot {
  return {
    source: "simulated",
    cpu: Math.round(48 + Math.sin(tick * 0.38) * 13),
    memory: Math.round(62 + Math.cos(tick * 0.21) * 7),
    temperature: Math.round(51 + Math.sin(tick * 0.17) * 5),
    upload: Number((1.2 + Math.sin(tick * 0.43) * 0.5).toFixed(2)),
    download: Number((4.8 + Math.cos(tick * 0.31) * 1.4).toFixed(2)),
    tasks: 214 + (tick % 9),
    historyA: wave(28, tick * 0.18, 48, 20),
    historyB: wave(28, tick * 0.12 + 2, 55, 14)
  };
}

export function sparklinePoints(values: number[], width = 280, height = 64): string {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  return values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}
