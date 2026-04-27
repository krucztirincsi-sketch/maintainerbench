import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createProgram } from "../src/index.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("maintainerbench CLI", () => {
  it("loads the command surface", () => {
    const program = createProgram();
    const commandNames = program.commands.map((command) => command.name()).sort();

    expect(program.name()).toBe("maintainerbench");
    expect(commandNames).toEqual(["eval", "init", "lint", "report"]);
  });

  it("renders help output", () => {
    const program = createProgram();
    const output: string[] = [];

    program.exitOverride();
    program.configureOutput({
      writeOut: (value: string) => output.push(value),
      writeErr: (value: string) => output.push(value)
    });

    try {
      program.parse(["node", "maintainerbench", "--help"]);
    } catch (error: unknown) {
      expect((error as { code?: string }).code).toBe("commander.helpDisplayed");
    }

    expect(output.join("")).toContain("Usage: maintainerbench");
    expect(output.join("")).toContain("Commands:");
  });

  it("declares the npm bin entry for the built CLI", async () => {
    const packageJson = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8")) as {
      bin?: Record<string, string>;
      files?: string[];
    };

    expect(packageJson.bin).toEqual({
      maintainerbench: "dist/index.js"
    });
    expect(packageJson.files).toContain("dist");
  });

  it("keeps a Node shebang on the CLI entry source", async () => {
    const entrySource = await readFile(path.join(packageRoot, "src/index.ts"), "utf8");

    expect(entrySource.startsWith("#!/usr/bin/env node\n")).toBe(true);
  });
});
