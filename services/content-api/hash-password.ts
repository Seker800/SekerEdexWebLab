import { hashAdminPassword } from "./http.js";

if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error("Run from an interactive terminal so the password is not echoed or saved in shell history");
process.stdout.write("Admin password (at least 16 characters): ");
process.stdin.setRawMode(true);
process.stdin.resume();
let password: number[] = [];
process.stdin.on("data", (chunk: Buffer) => {
  for (const byte of chunk) {
    if (byte === 3) { process.stdin.setRawMode(false); process.stdout.write("\n"); process.exit(130); }
    if (byte === 13 || byte === 10) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      try { process.stdout.write(`${hashAdminPassword(Buffer.from(password).toString("utf8"))}\n`); }
      catch (error) { console.error(error instanceof Error ? error.message : "Invalid password"); process.exitCode = 1; }
      password = [];
      return;
    }
    if (byte === 127 || byte === 8) password = password.slice(0, -1);
    else password.push(byte);
  }
});
