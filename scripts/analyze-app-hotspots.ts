import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { analyzeVisualHotspots } from "../src/comparison/visual-hotspots.js";

const root = process.cwd();
const artifactDirectory = path.join(root, "artifacts", "app-verification");
const targetPath = path.join(root, "references", "edex-ui-v2.2.8", "screenshot_default.png");
const replicaPath = path.join(artifactDirectory, "command-deck.png");
const report = await analyzeVisualHotspots(
  targetPath,
  replicaPath
);
const perceptualReport = await analyzeVisualHotspots(targetPath, replicaPath, { threshold: 0.08, includeAA: true });
await mkdir(artifactDirectory, { recursive: true });
const outputPath = path.join(artifactDirectory, "visible-hotspots.json");
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
const perceptualOutputPath = path.join(artifactDirectory, "perceptual-hotspots.json");
await writeFile(perceptualOutputPath, `${JSON.stringify(perceptualReport, null, 2)}\n`, "utf8");
process.stdout.write(`Visible hotspot diagnostic: ${(report.differenceRatio * 100).toFixed(2)}%; perceptual ${(perceptualReport.differenceRatio * 100).toFixed(2)}%; ${outputPath}\n`);
