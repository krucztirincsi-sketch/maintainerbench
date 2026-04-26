import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runEvalCommand } from "../src/commands/eval.js";
import { calculateEvalStatus, type EvalCommandRecord, type EvalReport, type EvalRiskFinding } from "../src/core/eval-runner.js";

describe("maintainerbench eval", () => {
  it("runs a successful fake agent command in an isolated worktree", async () => {
    const repo = await createGitRepo();
    await writeTask(
      repo,
      `id: success
title: Successful fake agent
setup:
  commands:
    - run: "echo setup-ok"
verify:
  commands:
    - run: "test -f feature.txt"
risk:
  require_tests: false
`
    );
    await commitAll(repo, "add success task");

    const output: string[] = [];
    const result = await runEvalCommand({
      cwd: repo,
      taskPath: ".maintainerbench/tasks/task.yml",
      agentCommand: "printf 'feature\\n' > feature.txt",
      runId: "eval-success",
      out: (line) => output.push(line)
    });

    expect(result.status).toBe("pass");
    expect(result.changedFiles).toEqual(["feature.txt"]);
    expect(result.commandResults.map((record) => record.stage)).toEqual(["setup", "agent", "verify"]);
    expect(result.commandResults.every((record) => record.result.exitCode === 0)).toBe(true);
    expect(result.riskFindings).toEqual([]);
    expect(output.join("\n")).toContain("Status: pass");
    expect(await pathExists(path.join(repo, ".maintainerbench", "runs", "eval-success", "report.md"))).toBe(true);
    expect(await pathExists(path.join(repo, ".maintainerbench", "runs", "eval-success", "report.json"))).toBe(true);

    const report = await readJsonReport(repo, "eval-success");
    expect(Object.keys(report)).toEqual([
      "schemaVersion",
      "runId",
      "status",
      "note",
      "task",
      "agentCommand",
      "elapsedMs",
      "worktree",
      "commands",
      "changedFiles",
      "diffSummary",
      "riskFindings"
    ]);
    expect(report).toMatchObject({
      schemaVersion: 1,
      runId: "eval-success",
      status: "pass",
      task: {
        id: "success",
        title: "Successful fake agent"
      },
      agentCommand: "printf 'feature\\n' > feature.txt",
      commands: {
        setup: [
          {
            stage: "setup",
            command: "echo setup-ok",
            exitCode: 0,
            timedOut: false,
            stdout: "setup-ok\n",
            stderr: ""
          }
        ],
        agent: {
          stage: "agent",
          command: "printf 'feature\\n' > feature.txt",
          exitCode: 0,
          timedOut: false,
          stderr: ""
        },
        verify: [
          {
            stage: "verify",
            command: "test -f feature.txt",
            exitCode: 0,
            timedOut: false,
            stdout: "",
            stderr: ""
          }
        ]
      },
      changedFiles: ["feature.txt"],
      riskFindings: []
    });
    expect(typeof report.elapsedMs).toBe("number");
    expect(report.note).toContain("guardrails");
  });

  it("fails when a verification command fails", async () => {
    const repo = await createGitRepo();
    await writeTask(
      repo,
      `id: failed-verify
title: Failed verification
verify:
  commands:
    - run: "test -f missing.txt"
`
    );
    await commitAll(repo, "add failed verify task");

    const result = await runEvalCommand({
      cwd: repo,
      taskPath: ".maintainerbench/tasks/task.yml",
      agentCommand: "printf 'feature\\n' > feature.txt",
      runId: "eval-failed-verify",
      out: () => undefined
    });

    expect(result.status).toBe("fail");
    expect(result.commandResults.at(-1)).toMatchObject({
      stage: "verify",
      command: "test -f missing.txt"
    });
    expect(result.commandResults.at(-1)?.result.exitCode).not.toBe(0);

    const markdownReport = await readMarkdownReport(repo, "eval-failed-verify");
    const jsonReport = await readJsonReport(repo, "eval-failed-verify");

    expect(markdownReport).toContain("test -f missing.txt");
    expect(markdownReport).toContain("| Status | fail |");
    expect(jsonReport.status).toBe("fail");
    expect(jsonReport.commands.verify[0]).toMatchObject({
      command: "test -f missing.txt",
      exitCode: 1
    });
  });

  it("reports risk when a forbidden file is changed", async () => {
    const repo = await createGitRepo();
    await writeTask(
      repo,
      `id: forbidden-file
title: Forbidden file
verify:
  commands:
    - run: "test -f secret.txt"
risk:
  forbidden_paths:
    - secret.txt
`
    );
    await commitAll(repo, "add forbidden file task");

    const result = await runEvalCommand({
      cwd: repo,
      taskPath: ".maintainerbench/tasks/task.yml",
      agentCommand: "printf 'secret\\n' > secret.txt",
      runId: "eval-forbidden-file",
      out: () => undefined
    });

    expect(result.status).toBe("needs-review");
    expect(result.riskFindings).toContainEqual({
      id: "eval.forbidden-path",
      level: "high",
      file: "secret.txt",
      message: "Changed forbidden path matching secret.txt."
    });

    const markdownReport = await readMarkdownReport(repo, "eval-forbidden-file");
    const jsonReport = await readJsonReport(repo, "eval-forbidden-file");

    expect(markdownReport).toContain("| needs-review |");
    expect(markdownReport).toContain("eval.forbidden-path");
    expect(jsonReport.status).toBe("needs-review");
    expect(jsonReport.riskFindings).toContainEqual({
      id: "eval.forbidden-path",
      level: "high",
      file: "secret.txt",
      message: "Changed forbidden path matching secret.txt."
    });
  });

  it("reports risk when too many files are changed", async () => {
    const repo = await createGitRepo();
    await writeTask(
      repo,
      `id: max-files
title: Max files
verify:
  commands:
    - run: "test -f one.txt"
risk:
  max_files_changed: 1
`
    );
    await commitAll(repo, "add max files task");

    const result = await runEvalCommand({
      cwd: repo,
      taskPath: ".maintainerbench/tasks/task.yml",
      agentCommand: "printf one > one.txt; printf two > two.txt",
      runId: "eval-max-files",
      out: () => undefined
    });

    expect(result.status).toBe("needs-review");
    expect(result.changedFiles).toEqual(["one.txt", "two.txt"]);
    expect(result.riskFindings).toContainEqual({
      id: "eval.too-many-files-changed",
      level: "high",
      message: "Changed 2 files, which exceeds max_files_changed 1."
    });
  });

  it("reports risk when a forbidden command pattern appears in changed files", async () => {
    const repo = await createGitRepo();
    await writeTask(
      repo,
      `id: forbidden-command
title: Forbidden command
verify:
  commands:
    - run: "test -f script.sh"
`
    );
    await commitAll(repo, "add forbidden command task");

    const result = await runEvalCommand({
      cwd: repo,
      taskPath: ".maintainerbench/tasks/task.yml",
      agentCommand: "printf 'rm -rf build\\n' > script.sh",
      runId: "eval-forbidden-command",
      out: () => undefined
    });

    expect(result.status).toBe("needs-review");
    expect(result.riskFindings.some((finding) => finding.id === "eval.forbidden-command.rm-rf")).toBe(true);
  });

  it("reports risk when tests are required but no test file changes", async () => {
    const repo = await createGitRepo();
    await writeTask(
      repo,
      `id: require-tests
title: Require tests
verify:
  commands:
    - run: "test -f feature.txt"
risk:
  require_tests: true
`
    );
    await commitAll(repo, "add require tests task");

    const result = await runEvalCommand({
      cwd: repo,
      taskPath: ".maintainerbench/tasks/task.yml",
      agentCommand: "printf feature > feature.txt",
      runId: "eval-require-tests",
      out: () => undefined
    });

    expect(result.status).toBe("needs-review");
    expect(result.riskFindings).toContainEqual({
      id: "eval.tests-required",
      level: "medium",
      message: "Task requires tests, but no changed file looks like a test."
    });
  });

  it("calculates report status from command and risk results", () => {
    const passingCommand = commandRecord(0);
    const failingCommand = commandRecord(1);
    const riskFinding: EvalRiskFinding = {
      id: "eval.too-many-files-changed",
      level: "high",
      message: "Changed too many files."
    };

    expect(calculateEvalStatus([passingCommand], [])).toBe("pass");
    expect(calculateEvalStatus([passingCommand], [riskFinding])).toBe("needs-review");
    expect(calculateEvalStatus([failingCommand], [riskFinding])).toBe("fail");
  });
});

async function readJsonReport(repo: string, runId: string): Promise<EvalReport> {
  const content = await readFile(path.join(repo, ".maintainerbench", "runs", runId, "report.json"), "utf8");
  return JSON.parse(content) as EvalReport;
}

async function readMarkdownReport(repo: string, runId: string): Promise<string> {
  return readFile(path.join(repo, ".maintainerbench", "runs", runId, "report.md"), "utf8");
}

async function createGitRepo(): Promise<string> {
  const repo = await mkdtemp(path.join(tmpdir(), "maintainerbench-eval-"));

  await runProcess("git", ["init"], repo);
  await runProcess("git", ["config", "user.email", "maintainerbench@example.invalid"], repo);
  await runProcess("git", ["config", "user.name", "MaintainerBench Test"], repo);
  await writeFile(path.join(repo, "README.md"), "# fixture repo\n", "utf8");
  await commitAll(repo, "initial commit");

  return repo;
}

async function writeTask(repo: string, content: string): Promise<void> {
  const taskPath = path.join(repo, ".maintainerbench", "tasks", "task.yml");
  await mkdir(path.dirname(taskPath), { recursive: true });
  await writeFile(taskPath, content, "utf8");
}

async function commitAll(repo: string, message: string): Promise<void> {
  await runProcess("git", ["add", "."], repo);
  await runProcess("git", ["commit", "-m", message], repo);
}

async function runProcess(command: string, args: readonly string[], cwd: string): Promise<void> {
  const result = await new Promise<{ exitCode: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd,
      shell: false,
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode: number | null) => {
      resolve({ exitCode, stderr });
    });
  });

  if (result.exitCode !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr}`);
  }
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await access(candidatePath);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function commandRecord(exitCode: number): EvalCommandRecord {
  return {
    stage: "verify",
    command: "fixture",
    result: {
      exitCode,
      stdout: "",
      stderr: "",
      timedOut: false,
      durationMs: 1,
      signal: null
    }
  };
}
