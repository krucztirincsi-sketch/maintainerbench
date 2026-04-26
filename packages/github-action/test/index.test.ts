import { describe, expect, it } from "vitest";
import { readInputs, runAction, type RunActionOptions } from "../src/index.js";

describe("MaintainerBench GitHub Action", () => {
  it("reads GitHub Action inputs", () => {
    expect(
      readInputs({
        INPUT_MODE: "lint",
        INPUT_TASK: ".maintainerbench/tasks/example.yml",
        INPUT_AGENT_COMMAND: "codex exec task",
        INPUT_FAIL_ON: "warning"
      })
    ).toEqual({
      mode: "lint",
      task: ".maintainerbench/tasks/example.yml",
      agentCommand: "codex exec task",
      failOn: "warning"
    });
  });

  it("runs MaintainerBench lint and prints a summary", async () => {
    const output: string[] = [];
    const result = await runAction({
      env: {
        INPUT_MODE: "lint",
        INPUT_FAIL_ON: "high"
      },
      out: (line) => output.push(line),
      cliCommand: {
        command: "maintainerbench",
        args: ["lint", "--json"]
      },
      commandRunner: async (command, args) => {
        expect(command).toBe("maintainerbench");
        expect(args).toEqual(["lint", "--json"]);

        return lintCommandResult(cleanLintResult());
      }
    });

    expect(result.failed).toBe(false);
    expect(output.join("\n")).toContain("Findings: 0 info, 0 warning, 0 high");
    expect(output.join("\n")).toContain("Conclusion: passed");
  });

  it("captures JSON output from a real child process", async () => {
    const result = await runAction({
      env: {
        INPUT_MODE: "lint",
        INPUT_FAIL_ON: "high"
      },
      out: () => undefined,
      cliCommand: {
        command: "printf",
        args: [JSON.stringify(cleanLintResult())]
      }
    });

    expect(result.failed).toBe(false);
    expect(result.lintResult.summary.high).toBe(0);
  });

  it("fails on warnings when fail-on is warning", async () => {
    const result = await runAction({
      env: {
        INPUT_MODE: "lint",
        INPUT_FAIL_ON: "warning"
      },
      out: () => undefined,
      cliCommand: fakeCliCommand(),
      commandRunner: async () =>
        lintCommandResult({
          ...cleanLintResult(),
          findings: [
            {
              id: "agents.missing-verification-guidance",
              severity: "warning",
              file: "AGENTS.md",
              message: "AGENTS.md should include setup, build, and test instructions."
            }
          ],
          summary: {
            info: 0,
            warning: 1,
            high: 0
          }
        })
    });

    expect(result.failed).toBe(true);
    expect(result.message).toContain("fail-on is warning");
  });

  it("does not fail on warnings when fail-on is high", async () => {
    const result = await runAction({
      env: {
        INPUT_MODE: "lint",
        INPUT_FAIL_ON: "high"
      },
      out: () => undefined,
      cliCommand: fakeCliCommand(),
      commandRunner: async () =>
        lintCommandResult({
          ...cleanLintResult(),
          findings: [
            {
              id: "agents.missing-verification-guidance",
              severity: "warning",
              file: "AGENTS.md",
              message: "AGENTS.md should include setup, build, and test instructions."
            }
          ],
          summary: {
            info: 0,
            warning: 1,
            high: 0
          }
        })
    });

    expect(result.failed).toBe(false);
  });

  it("does not fail on high findings when fail-on is never", async () => {
    const result = await runAction({
      env: {
        INPUT_MODE: "lint",
        INPUT_FAIL_ON: "never"
      },
      out: () => undefined,
      cliCommand: fakeCliCommand(),
      commandRunner: async () =>
        lintCommandResult(
          {
            ...cleanLintResult(),
            findings: [
              {
                id: "dangerous-command.rm-rf",
                severity: "high",
                file: "AGENTS.md",
                message: "Avoid recursive force deletion in agent instructions or workflows."
              }
            ],
            summary: {
              info: 0,
              warning: 0,
              high: 1
            }
          },
          1
        )
    });

    expect(result.failed).toBe(false);
  });

  it("rejects eval mode without running a command", async () => {
    let commandWasRun = false;

    await expect(
      runAction({
        env: {
          INPUT_MODE: "eval",
          INPUT_AGENT_COMMAND: "codex exec task"
        },
        out: () => undefined,
        cliCommand: fakeCliCommand(),
        commandRunner: async () => {
          commandWasRun = true;
          return lintCommandResult(cleanLintResult());
        }
      })
    ).rejects.toThrow("mode=eval is not supported");

    expect(commandWasRun).toBe(false);
  });
});

function fakeCliCommand(): NonNullable<RunActionOptions["cliCommand"]> {
  return {
    command: "maintainerbench",
    args: ["lint", "--json"]
  };
}

function cleanLintResult(): {
  readonly root: string;
  readonly checkedFiles: readonly string[];
  readonly findings: readonly unknown[];
  readonly summary: {
    readonly info: number;
    readonly warning: number;
    readonly high: number;
  };
} {
  return {
    root: "/repo",
    checkedFiles: ["AGENTS.md"],
    findings: [],
    summary: {
      info: 0,
      warning: 0,
      high: 0
    }
  };
}

function lintCommandResult(result: ReturnType<typeof cleanLintResult>, exitCode = 0): {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
} {
  return {
    exitCode,
    stdout: `${JSON.stringify(result)}\n`,
    stderr: ""
  };
}
