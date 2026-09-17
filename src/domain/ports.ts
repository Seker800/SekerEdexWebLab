import type { CaptureResult, RepairRequest, RepairResult, Viewport } from "./types.js";

export interface PageCollector {
  capture(url: string, viewport: Viewport, outputPath: string, readySelector?: string): Promise<CaptureResult>;
  close(): Promise<void>;
}

export interface RepairAgent {
  repair(request: RepairRequest): Promise<RepairResult>;
}
