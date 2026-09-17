export type RunStatus = "passed" | "failed" | "blocked";

export interface Viewport {
  width: number;
  height: number;
}

export interface BrowserDiagnostics {
  consoleErrors: string[];
  pageErrors: string[];
  finalUrl: string;
}

export interface CaptureResult {
  screenshotPath: string;
  diagnostics: BrowserDiagnostics;
}

export interface VisualMetrics {
  targetWidth: number;
  targetHeight: number;
  replicaWidth: number;
  replicaHeight: number;
  comparedWidth: number;
  comparedHeight: number;
  differentPixels: number;
  totalPixels: number;
  differenceRatio: number;
  dimensionsMatch: boolean;
}

export interface Verdict {
  status: "passed" | "failed";
  reasons: string[];
  metrics: VisualMetrics;
}

export interface AttemptReport {
  attempt: number;
  replica: CaptureResult;
  verdict: Verdict;
  repair?: RepairResult;
  repairCandidate?: {
    replica: CaptureResult;
    verdict: Verdict;
    decision: "accepted" | "rejected";
    reason: string;
  };
}

export interface FinalReport {
  runId: string;
  scenarioId: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string;
  target: CaptureResult;
  attempts: AttemptReport[];
  artifactDirectory: string;
  blocker?: string;
}

export interface SourceEvidence {
  repositoryUrl: string;
  revision: string;
  localPath: string;
  guidePath?: string | undefined;
  entryPaths: string[];
  modules?: Array<{
    name: string;
    entryPaths: string[];
  }> | undefined;
}

export interface RepairRequest {
  scenarioId: string;
  attempt: number;
  contractPath: string;
  targetScreenshotPath: string;
  replicaScreenshotPath: string;
  diffScreenshotPath: string;
  verdictPath: string;
  allowedPaths: string[];
  validationCommands: string[][];
  rejectedRepairs: Array<{
    attempt: number;
    summary: string;
    changedFiles: string[];
    reason: string;
    baselineDifferenceRatio: number;
    candidateDifferenceRatio: number;
  }>;
  regionEvidence?: Array<{
    name: string;
    diffScreenshotPath: string;
    metrics: VisualMetrics;
  }> | undefined;
  sourceEvidence?: SourceEvidence;
}

export interface RepairResult {
  status: "changed" | "no_change" | "blocked";
  summary: string;
  changedFiles: string[];
  validations: Array<{ command: string; passed: boolean; summary: string }>;
  remainingDifferences: string[];
}
