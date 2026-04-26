import { lstat, mkdir, realpath, rm, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { runVerificationCommand, type VerificationCommand, type VerificationResult } from "./command-runner.js";

export interface WorktreePlanOptions {
  readonly repoRoot: string;
  readonly taskId: string;
}

export interface WorktreePlan {
  readonly repoRoot: string;
  readonly branchName: string;
  readonly worktreePath: string;
}

export interface GitRepositoryInfo {
  readonly root: string;
}

export interface CreateWorktreeRunOptions {
  readonly cwd?: string;
  readonly runId?: string;
  readonly baseRef?: string;
  readonly keepWorktree?: boolean;
}

export interface WorktreeRun {
  readonly repoRoot: string;
  readonly runId: string;
  readonly runDirectory: string;
  readonly worktreePath: string;
  readonly baseRef: string;
  readonly keepWorktree: boolean;
}

export interface WorktreeCommand {
  readonly command: string;
  readonly args?: readonly string[];
  readonly timeoutMs?: number;
  readonly env?: NodeJS.ProcessEnv;
}

export type WorktreeCommandResult = VerificationResult;

export interface CleanupWorktreeRunOptions {
  readonly force?: boolean;
}

export interface CleanupWorktreeRunResult {
  readonly removed: boolean;
  readonly reason?: string;
}

const runsDirectoryName = ".maintainerbench/runs";

export function createWorktreePlan(options: WorktreePlanOptions): WorktreePlan {
  const safeTaskId = toSafeRunId(options.taskId);

  return {
    repoRoot: options.repoRoot,
    branchName: `maintainerbench/${safeTaskId}`,
    worktreePath: path.join(options.repoRoot, ".maintainerbench", "runs", safeTaskId, "worktree")
  };
}

export async function detectGitRepository(cwd: string = process.cwd()): Promise<GitRepositoryInfo | null> {
  const resolvedCwd = path.resolve(cwd);
  const result = await runVerificationCommand({
    command: "git",
    args: ["-C", resolvedCwd, "rev-parse", "--show-toplevel"],
    cwd: resolvedCwd
  });

  if (result.exitCode !== 0) {
    return null;
  }

  const root = result.stdout.trim();

  if (root.length === 0) {
    return null;
  }

  return { root: await realpath(root) };
}

export async function isGitRepository(cwd: string = process.cwd()): Promise<boolean> {
  return (await detectGitRepository(cwd)) !== null;
}

export async function createWorktreeRun(options: CreateWorktreeRunOptions = {}): Promise<WorktreeRun> {
  const repository = await detectGitRepository(options.cwd ?? process.cwd());

  if (repository === null) {
    throw new Error("Current directory is not inside a git repository.");
  }

  const repoRoot = repository.root;
  const runId = toSafeRunId(options.runId ?? createRunId());
  const runDirectory = resolveInsideRoot(repoRoot, path.join(runsDirectoryName, runId));
  const worktreePath = resolveInsideRoot(repoRoot, path.join(runsDirectoryName, runId, "worktree"));
  const baseRef = options.baseRef ?? "HEAD";

  await ensureDirectoryInsideRoot(repoRoot, runDirectory);

  try {
    await runGit(repoRoot, ["worktree", "add", "--detach", worktreePath, baseRef]);
  } catch (error: unknown) {
    await rm(runDirectory, { recursive: true, force: true });
    throw error;
  }

  return {
    repoRoot,
    runId,
    runDirectory,
    worktreePath,
    baseRef,
    keepWorktree: options.keepWorktree === true
  };
}

export async function runCommandInWorktree(
  run: WorktreeRun,
  command: WorktreeCommand
): Promise<WorktreeCommandResult> {
  const worktreePath = await assertExistingWorktreePath(run);
  const verificationCommand: VerificationCommand = {
    command: command.command,
    cwd: worktreePath,
    ...(command.args === undefined ? {} : { args: command.args }),
    ...(command.timeoutMs === undefined ? {} : { timeoutMs: command.timeoutMs }),
    ...(command.env === undefined ? {} : { env: command.env })
  };

  return runVerificationCommand(verificationCommand);
}

export async function cleanupWorktreeRun(
  run: WorktreeRun,
  options: CleanupWorktreeRunOptions = {}
): Promise<CleanupWorktreeRunResult> {
  assertRunPathShape(run);

  if (run.keepWorktree && options.force !== true) {
    return {
      removed: false,
      reason: "keepWorktree is enabled"
    };
  }

  await assertSafeDirectoryForRemoval(run.repoRoot, run.runDirectory);

  const worktreeExists = await pathExists(run.worktreePath);

  if (worktreeExists) {
    await assertExistingWorktreePath(run);
    await runGit(run.repoRoot, ["worktree", "remove", "--force", run.worktreePath]);
  }

  await rm(run.runDirectory, { recursive: true, force: true });

  return { removed: true };
}

async function runGit(repoRoot: string, args: readonly string[]): Promise<VerificationResult> {
  const result = await runVerificationCommand({
    command: "git",
    args: ["-C", repoRoot, ...args],
    cwd: repoRoot
  });

  if (result.exitCode !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${String(result.exitCode)}`;
    throw new Error(`Git command failed: git ${args.join(" ")}\n${detail}`);
  }

  return result;
}

function createRunId(): string {
  return `run-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
}

function toSafeRunId(runId: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(runId) || runId === "." || runId === "..") {
    throw new Error(`Unsafe run id: ${runId}`);
  }

  return runId;
}

function resolveInsideRoot(root: string, relativePath: string): string {
  const resolvedPath = path.resolve(root, relativePath);

  if (!isInsideRoot(root, resolvedPath)) {
    throw new Error(`Refusing to use a path outside the repository: ${relativePath}`);
  }

  return resolvedPath;
}

async function assertExistingWorktreePath(run: WorktreeRun): Promise<string> {
  assertRunPathShape(run);

  const worktreeStat = await lstat(run.worktreePath);

  if (!worktreeStat.isDirectory() || worktreeStat.isSymbolicLink()) {
    throw new Error(`Refusing to run commands in an unsafe worktree path: ${run.worktreePath}`);
  }

  const resolvedWorktreePath = await realpath(run.worktreePath);

  if (!isInsideRoot(run.repoRoot, resolvedWorktreePath) || resolvedWorktreePath === run.repoRoot) {
    throw new Error(`Refusing to run commands outside the worktree: ${run.worktreePath}`);
  }

  return resolvedWorktreePath;
}

function assertRunPathShape(run: WorktreeRun): void {
  const safeRunId = toSafeRunId(run.runId);
  const expectedRunDirectory = path.resolve(run.repoRoot, runsDirectoryName, safeRunId);
  const expectedWorktreePath = path.resolve(expectedRunDirectory, "worktree");

  if (path.resolve(run.runDirectory) !== expectedRunDirectory) {
    throw new Error(`Refusing to use unexpected run directory: ${run.runDirectory}`);
  }

  if (path.resolve(run.worktreePath) !== expectedWorktreePath) {
    throw new Error(`Refusing to use unexpected worktree path: ${run.worktreePath}`);
  }

  if (!isInsideRoot(run.repoRoot, expectedRunDirectory) || !isInsideRoot(run.repoRoot, expectedWorktreePath)) {
    throw new Error("Refusing to use worktree paths outside the repository.");
  }
}

async function assertSafeDirectoryForRemoval(root: string, directoryPath: string): Promise<void> {
  const resolvedDirectoryPath = path.resolve(directoryPath);

  if (resolvedDirectoryPath === path.resolve(root) || !isInsideRoot(root, resolvedDirectoryPath)) {
    throw new Error(`Refusing to remove unsafe directory: ${directoryPath}`);
  }

  const directoryStat = await lstat(resolvedDirectoryPath);

  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    throw new Error(`Refusing to remove unsafe run directory: ${directoryPath}`);
  }
}

async function ensureDirectoryInsideRoot(root: string, directoryPath: string): Promise<void> {
  if (!isInsideRoot(root, directoryPath)) {
    throw new Error(`Refusing to create a directory outside the repository: ${directoryPath}`);
  }

  const relativePath = path.relative(root, directoryPath);

  if (relativePath.length === 0) {
    return;
  }

  const segments = relativePath.split(path.sep).filter((segment) => segment.length > 0);
  let currentPath = root;

  for (const segment of segments) {
    currentPath = path.join(currentPath, segment);

    try {
      const currentStat = await lstat(currentPath);

      if (currentStat.isSymbolicLink()) {
        const target = await realpath(currentPath);

        if (!isInsideRoot(root, target)) {
          throw new Error(`Refusing to write through a symlink outside the repository: ${currentPath}`);
        }

        const targetStat = await stat(currentPath);

        if (!targetStat.isDirectory()) {
          throw new Error(`Refusing to use a non-directory parent path: ${currentPath}`);
        }
      } else if (!currentStat.isDirectory()) {
        throw new Error(`Refusing to use a non-directory parent path: ${currentPath}`);
      }
    } catch (error: unknown) {
      if (isNodeErrorWithCode(error, "ENOENT")) {
        await mkdir(currentPath);
        continue;
      }

      throw error;
    }
  }
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await lstat(candidatePath);
    return true;
  } catch (error: unknown) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return false;
    }

    throw error;
  }
}

function isInsideRoot(root: string, candidatePath: string): boolean {
  const relativePath = path.relative(path.resolve(root), path.resolve(candidatePath));
  return relativePath.length === 0 || (relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath));
}

function isNodeErrorWithCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;
}
