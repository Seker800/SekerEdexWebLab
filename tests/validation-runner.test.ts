import { describe, expect, it } from "vitest";
import { runValidationCommands } from "../src/adapters/process/validation-runner.js";

describe("validation runner", () => {
  it("executes argument arrays without a shell", async () => {
    await expect(runValidationCommands([[process.execPath, "-e", "process.exit(0)"]], process.cwd())).resolves.toBeUndefined();
  });

  it("rejects a failing validation command", async () => {
    await expect(runValidationCommands([[process.execPath, "-e", "process.exit(7)"]], process.cwd()))
      .rejects.toThrow("Validation command failed");
  });
});
