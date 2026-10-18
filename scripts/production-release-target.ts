import { execFile as execFileCallback } from "node:child_process";
import { lstat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { assertSiteOwnedObjectKey } from "./release-boundaries.js";

const execFile = promisify(execFileCallback);
const productionBucket = "seker-edex-web";
const productionRegion = "cn-beijing";
export const productionOrigin = "https://www.seker.wang";
const aliyunProfile = process.env.SEKER_ALIYUN_PROFILE || "seker-edex-local";
const aliyunConfig = process.env.SEKER_ALIYUN_CONFIG_PATH ? ["--config-path", process.env.SEKER_ALIYUN_CONFIG_PATH] : [];
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

export async function uploadProductionObject(owner: "site", localPath: string, objectKey: string, cacheControl: string, cwd: string): Promise<void> {
  assertSiteOwnedObjectKey(objectKey);
  await runCommand(aliyunExecutable, [
    "oss", "cp", localPath, `oss://${productionBucket}/${objectKey}`,
    "--profile", aliyunProfile, ...aliyunConfig,
    "--region", productionRegion,
    "--force",
    "--yes",
    "--cli-non-interactive",
    "--meta", `Cache-Control:${cacheControl}`
  ], cwd);
}

export async function removeProductionObject(owner: "site", objectKey: string, cwd: string): Promise<void> {
  assertSiteOwnedObjectKey(objectKey);
  await runCommand(aliyunExecutable, [
    "oss", "rm", `oss://${productionBucket}/${objectKey}`,
    "--profile", aliyunProfile, ...aliyunConfig,
    "--region", productionRegion,
    "--force",
    "--yes",
    "--cli-non-interactive"
  ], cwd);
}

export async function refreshProductionCdn(objectPath: string, objectType: "File" | "Directory", cwd: string): Promise<void> {
  await runCommand(aliyunExecutable, [
    "cdn", "RefreshObjectCaches",
    "--profile", aliyunProfile, ...aliyunConfig,
    "--region", productionRegion,
    "--ObjectPath", objectPath,
    "--ObjectType", objectType
  ], cwd);
}
