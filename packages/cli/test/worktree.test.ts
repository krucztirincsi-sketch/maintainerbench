import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  cleanupWorktreeRun,
  createWorktreeRun,
  detectGitRepository,
  isGitRepository,
  runCommandInWorktree,
  type WorktreeRun
} from "../src/core/worktree.js";

describe("worktree runner foundation", () => {
  it("detects whether a directory is inside a git repository", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maintainerbench-not-git-"));

    expect(await detectGitRepository(directory)).toBeNull();
    expect(await isGitRepository(directory)).toBe(false);

    const repo = await createGitRepo();
    const detected = await detectGitRepository(repo);

    expect(detected?.root).toBe(await realRepoPath(repo));
    expect(await isGitRepository(repo)).toBe(true);
  });

  it("creates and cleans up a temporary worktree without deleting the main repository", async () => {
    const repo = await createGitRepo();
    const run = await createWorktreeRun({ cwd: repo, runId: "cleanup-test" });

    expect(run.repoRoot).toBe(await realRepoPath(repo));
    expect(run.worktreePath).toBe(path.join(run.repoRoot, ".maintainerbench", "runs", "cleanup-test", "worktree"));
    expect(await pathExists(path.join(run.worktreePath, "README.md"))).toBe(true);

    const cleanup = await cleanupWorktreeRun(run);

    expect(cleanup).toEqual({ removed: true });
    expect(await pathExists(run.worktreePath)).toBe(false);
    expect(await readFile(path.join(repo, "README.md"), "utf8")).toContain("fixture repo");
  });

  it("runs commands inside the worktree and captures stdout, stderr, exit code, and duration", async () => {
    const repo = await createGitRepo();
    const run = await createWorktreeRun({ cwd: repo, runId: "command-test" });

    try {
      const result = await runCommandInWorktree(run, {
        command: "sh",
        args: ["-c", "pwd; echo stderr-ok >&2; exit 7"]
      });

      expect(result.exitCode).toBe(7);
      expect(result.stdout.trim()).toBe(await realRepoPath(run.worktreePath));
      expect(result.stderr.trim()).toBe("stderr-ok");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.timedOut).toBe(false);
    } finally {
      await cleanupWorktreeRun(run, { force: true });
    }
  });

  it("keeps the worktree when keepWorktree is enabled", async () => {
    const repo = await createGitRepo();
    const run = await createWorktreeRun({ cwd: repo, runId: "keep-test", keepWorktree: true });

    const cleanup = await cleanupWorktreeRun(run);

    expect(cleanup).toEqual({ removed: false, reason: "keepWorktree is enabled" });
    expect(await pathExists(run.worktreePath)).toBe(true);

    await cleanupWorktreeRun(run, { force: true });
    expect(await pathExists(run.worktreePath)).toBe(false);
  });

  it("rejects path traversal in run ids", async () => {
    const repo = await createGitRepo();

    await expect(createWorktreeRun({ cwd: repo, runId: "../escape" })).rejects.toThrow("Unsafe run id");
  });

  it("refuses to run a command when the worktree path has been tampered outside the run directory", async () => {
    const repo = await createGitRepo();
    const run = await createWorktreeRun({ cwd: repo, runId: "tamper-test" });
    const tamperedRun: WorktreeRun = {
      ...run,
      worktreePath: repo
    };

    try {
      await expect(
        runCommandInWorktree(tamperedRun, {
          command: process.execPath,
          args: ["-e", "console.log('should-not-run')"]
        })
      ).rejects.toThrow("Refusing to use unexpected worktree path");
    } finally {
      await cleanupWorktreeRun(run, { force: true });
    }
  });
});

async function createGitRepo(): Promise<string> {
  const repo = await mkdtemp(path.join(tmpdir(), "maintainerbench-git-"));

  await runProcess("git", ["init"], repo);
  await runProcess("git", ["config", "user.email", "maintainerbench@example.invalid"], repo);
  await runProcess("git", ["config", "user.name", "MaintainerBench Test"], repo);
  await writeFile(path.join(repo, "README.md"), "# fixture repo\n", "utf8");
  await runProcess("git", ["add", "README.md"], repo);
  await runProcess("git", ["commit", "-m", "initial commit"], repo);

  return repo;
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

async function realRepoPath(repo: string): Promise<string> {
  return path.resolve(await realpath(repo));
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
