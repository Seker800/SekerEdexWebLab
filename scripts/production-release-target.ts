import { execFile as execFileCallback } from "node:child_process";
import { lstat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { assertContentOwnedObjectKey, assertSiteOwnedObjectKey } from "./release-boundaries.js";

const execFile = promisify(execFileCallback);
const productionBucket = "seker-edex-web";
const productionRegion = "cn-beijing";
export const productionOrigin = "https://www.seker.wang";
const aliyunProfile = "seker-edex-local";
const aliyunExecutable = path.join(homedir(), ".local", "bin", "aliyun");

export async function runCommand(command: string, args: string[], cwd: string, environment?: NodeJS.ProcessEnv): Promise<string> {
  const { stdout, stderr } = await execFile(command, args, {
    cwd,
    env: environment ?? process.env,
    maxBuffer: 20 * 1024 * 1024
  });
  if (stderr.trim()) process.stderr.write(stderr);
  return stdout;
}

export async function requireProductionReleaseTools(): Promise<void> {
  const stats = await lstat(aliyunExecutable);
  if (!stats.isFile()) throw new Error("The configured Aliyun CLI executable is not a regular file.");
}

export async function uploadProductionObject(owner: "site" | "content", localPath: string, objectKey: string, cacheControl: string, cwd: string): Promise<void> {
  if (owner === "site") assertSiteOwnedObjectKey(objectKey);
  else assertContentOwnedObjectKey(objectKey);
  await runCommand(aliyunExecutable, [
    "oss", "cp", localPath, `oss://${productionBucket}/${objectKey}`,
    "--profile", aliyunProfile,
    "--region", productionRegion,
    "--force",
    "--yes",
    "--cli-non-interactive",
    "--meta", `Cache-Control:${cacheControl}`
  ], cwd);
}

export async function removeProductionObject(owner: "site" | "content", objectKey: string, cwd: string): Promise<void> {
  if (owner === "site") assertSiteOwnedObjectKey(objectKey);
  else assertContentOwnedObjectKey(objectKey);
  await runCommand(aliyunExecutable, [
    "oss", "rm", `oss://${productionBucket}/${objectKey}`,
    "--profile", aliyunProfile,
    "--region", productionRegion,
    "--force",
    "--yes",
    "--cli-non-interactive"
  ], cwd);
}

export async function refreshProductionCdn(objectPath: string, objectType: "File" | "Directory", cwd: string): Promise<void> {
  await runCommand(aliyunExecutable, [
    "cdn", "RefreshObjectCaches",
    "--profile", aliyunProfile,
    "--region", productionRegion,
    "--ObjectPath", objectPath,
    "--ObjectType", objectType
  ], cwd);
}
