import { describe, expect, it } from "vitest";
import { scenarioContractSchema } from "../src/config/contract.js";

describe("scenario contract", () => {
  it("accepts a bounded visual scenario", () => {
    const contract = scenarioContractSchema.parse({
      scenarioId: "home-page",
      targetUrl: "https://example.com",
      replicaUrl: "http://127.0.0.1:3000",
      viewport: { width: 1280, height: 720 },
      maxDifferenceRatio: 0.01,
      comparisonOptions: { threshold: 0.08, includeAA: true },
      comparisonRegions: {
        terminal: { x: 100, y: 20, width: 900, height: 500 }
      }
    });
    expect(contract.maxAttempts).toBe(1);
    expect(contract.allowedPaths).toEqual([]);
    expect(contract.comparisonOptions).toEqual({ threshold: 0.08, includeAA: true });
    expect(contract.comparisonRegions?.terminal).toEqual({ x: 100, y: 20, width: 900, height: 500 });
  });

  it("rejects unbounded attempts and invalid ratios", () => {
    expect(() => scenarioContractSchema.parse({
      scenarioId: "home-page",
      targetUrl: "https://example.com",
      replicaUrl: "http://127.0.0.1:3000",
      viewport: { width: 1280, height: 720 },
      maxDifferenceRatio: 2,
      maxAttempts: 999
    })).toThrow();
  });

  it("rejects repair paths that overlap controller or evidence files", () => {
    const base = {
      scenarioId: "unsafe-repair-path",
      targetUrl: "https://example.com",
      replicaUrl: "http://127.0.0.1:3000",
      viewport: { width: 1280, height: 720 },
      maxDifferenceRatio: 0.1
    };
    for (const allowedPath of [".", "src", "src/judge", "artifacts/runs", "references"]) {
      expect(() => scenarioContractSchema.parse({ ...base, allowedPaths: [allowedPath] })).toThrow();
    }
    expect(() => scenarioContractSchema.parse({ ...base, allowedPaths: ["apps/clone"] })).toThrow();
    expect(scenarioContractSchema.parse({ ...base, allowedPaths: ["apps/clone/src"] }).allowedPaths).toEqual(["apps/clone/src"]);
  });

  it("accepts frozen screenshot evidence and requires one target source", () => {
    expect(scenarioContractSchema.parse({
      scenarioId: "frozen-reference",
      targetScreenshotPath: "references/reference.png",
      replicaUrl: "http://127.0.0.1:3000",
      viewport: { width: 1280, height: 720 },
      maxDifferenceRatio: 0.1
    }).targetScreenshotPath).toBe("references/reference.png");

    expect(() => scenarioContractSchema.parse({
      scenarioId: "ambiguous-reference",
      targetUrl: "https://example.com",
      targetScreenshotPath: "references/reference.png",
      replicaUrl: "http://127.0.0.1:3000",
      viewport: { width: 1280, height: 720 },
      maxDifferenceRatio: 0.1
    })).toThrow("Provide exactly one");
  });

  it("accepts bounded source evidence for source-first reconstruction", () => {
    const contract = scenarioContractSchema.parse({
      scenarioId: "source-backed-reference",
      targetScreenshotPath: "references/reference.png",
      replicaUrl: "http://127.0.0.1:3000",
      viewport: { width: 1280, height: 720 },
      maxDifferenceRatio: 0.1,
      sourceEvidence: {
        repositoryUrl: "https://github.com/example/reference-app.git",
        revision: "0123456789abcdef",
        localPath: ".cache/upstream/reference-app",
        guidePath: "docs/SOURCE_PORT_MAP.md",
        entryPaths: ["src/shell.css", "src/shell.ts"]
      }
    });

    expect(contract.sourceEvidence?.revision).toBe("0123456789abcdef");
    expect(contract.sourceEvidence?.entryPaths).toEqual(["src/shell.css", "src/shell.ts"]);
  });

  it("rejects source evidence paths that escape their declared roots", () => {
    const base = {
      scenarioId: "unsafe-source-reference",
      targetScreenshotPath: "references/reference.png",
      replicaUrl: "http://127.0.0.1:3000",
      viewport: { width: 1280, height: 720 },
      maxDifferenceRatio: 0.1
    };

    expect(() => scenarioContractSchema.parse({
      ...base,
      sourceEvidence: {
        repositoryUrl: "https://github.com/example/reference-app.git",
        revision: "main",
        localPath: "../reference-app",
        entryPaths: ["src/shell.css"]
      }
    })).toThrow();

    expect(() => scenarioContractSchema.parse({
      ...base,
      sourceEvidence: {
        repositoryUrl: "https://github.com/example/reference-app.git",
        revision: "main",
        localPath: ".cache/upstream/reference-app",
        entryPaths: ["../outside.css"]
      }
    })).toThrow();
  });

  it("rejects comparison profiles that name undeclared regions", () => {
    expect(() => scenarioContractSchema.parse({
      scenarioId: "invalid-region-profile",
      targetScreenshotPath: "references/reference.png",
      replicaUrl: "http://127.0.0.1:3000",
      viewport: { width: 1280, height: 720 },
      maxDifferenceRatio: 0.1,
      comparisonRegions: { terminal: { x: 0, y: 0, width: 100, height: 100 } },
      perceptualComparison: {
        maxDifferenceRatio: 0.2,
        comparisonOptions: { threshold: 0.08, includeAA: true },
        regionMaxDifferenceRatios: { keyboard: 0.2 }
      }
    })).toThrow("unknown region keyboard");
  });
});
