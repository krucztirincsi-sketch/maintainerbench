import { describe, expect, it } from "vitest";
import { createProgram } from "../src/index.js";

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
});
