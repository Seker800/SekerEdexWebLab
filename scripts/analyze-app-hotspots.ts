import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { analyzeVisualHotspots } from "../src/comparison/visual-hotspots.js";

const root = process.cwd();
const artifactDirectory = path.join(root, "artifacts", "app-verification");
const report = await analyzeVisualHotspots(
  path.join(root, "references", "edex-ui-v2.2.8", "screenshot_default.png"),
  path.join(artifactDirectory, "command-deck.png")
);
await mkdir(artifactDirectory, { recursive: true });
const outputPath = path.join(artifactDirectory, "visible-hotspots.json");
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`Visible hotspot diagnostic: ${(report.differenceRatio * 100).toFixed(2)}%; ${outputPath}\n`);
