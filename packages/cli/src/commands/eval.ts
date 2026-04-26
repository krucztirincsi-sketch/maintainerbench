import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { runEvalTask, type EvalResult } from "../core/eval-runner.js";
import { detectGitRepository } from "../core/worktree.js";
import { parseBenchmarkTaskYaml } from "../core/task-schema.js";

export interface RunEvalCommandOptions {
  readonly cwd?: string;
  readonly taskPath: string;
  readonly agentCommand: string;
  readonly keepWorktree?: boolean;
  readonly runId?: string;
  readonly out?: (line: string) => void;
}

export function registerEvalCommand(program: Command): void {
  program
    .command("eval")
    .description("Run a benchmark task in an isolated git worktree.")
    .requiredOption("--task <path>", "Benchmark task YAML file.")
    .requiredOption("--agent-command <command>", "External agent shell command to run inside the worktree.")
    .option("--keep-worktree", "Keep the temporary worktree for inspection.")
    .option("--run-id <id>", "Run identifier used under .maintainerbench/runs.")
    .action(async (options: { task: string; agentCommand: string; keepWorktree?: boolean; runId?: string }) => {
      const result = await runEvalCommand({
        taskPath: options.task,
        agentCommand: options.agentCommand,
        keepWorktree: options.keepWorktree === true,
        ...(options.runId === undefined ? {} : { runId: options.runId })
      });

      if (result.status !== "pass") {
        process.exitCode = 1;
      }
    });
}

export async function runEvalCommand(options: RunEvalCommandOptions): Promise<EvalResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const repository = await detectGitRepository(cwd);

  if (repository === null) {
    throw new Error("maintainerbench eval must be run inside a git repository.");
  }

  const taskPath = await resolveTaskPath(repository.root, cwd, options.taskPath);
  const task = parseBenchmarkTaskYaml(await readFile(taskPath, "utf8"));
  const result = await runEvalTask({
    cwd: repository.root,
    task,
    agentCommand: options.agentCommand,
    ...(options.keepWorktree === undefined ? {} : { keepWorktree: options.keepWorktree }),
    ...(options.runId === undefined ? {} : { runId: options.runId })
  });

  printEvalResult(result, options.out ?? ((line: string) => console.log(line)));

  return result;
}

async function resolveTaskPath(repoRoot: string, cwd: string, taskPath: string): Promise<string> {
  if (taskPath.includes("\0")) {
    throw new Error("Task path must not contain a null byte.");
  }

  const absolutePath = path.resolve(cwd, taskPath);
  const relativePath = path.relative(repoRoot, absolutePath);

  if (relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to read a task outside the repository: ${taskPath}`);
  }

  const resolvedPath = await realpath(absolutePath);
  const resolvedRelativePath = path.relative(repoRoot, resolvedPath);

  if (resolvedRelativePath === ".." || resolvedRelativePath.startsWith(`..${path.sep}`) || path.isAbsolute(resolvedRelativePath)) {
    throw new Error(`Refusing to read a task outside the repository: ${taskPath}`);
  }

  return resolvedPath;
}

function printEvalResult(result: EvalResult, out: (line: string) => void): void {
  out("MaintainerBench eval result");
  out(`Status: ${result.status}`);
  out(`Task: ${result.taskId} - ${result.taskTitle}`);
  out(`Run: ${result.runId}`);
  out(`Worktree: ${result.worktreePath}${result.keptWorktree ? " (kept)" : " (removed)"}`);
  out(`Markdown report: ${result.reportMarkdownPath}`);
  out(`JSON report: ${result.reportJsonPath}`);
  out(`Elapsed: ${result.elapsedMs}ms`);
  out("MaintainerBench provides guardrails and benchmark reports, not guaranteed security or complete sandboxing.");
  out("");
  out(`Changed files: ${result.changedFiles.length}`);

  if (result.changedFiles.length === 0) {
    out("  (none)");
  } else {
    for (const file of result.changedFiles) {
      out(`  - ${file}`);
    }
  }

  out("");
  out("Diff summary:");
  out(result.diffSummary.trim().length === 0 ? "  (none)" : indent(result.diffSummary.trim()));
  out("");
  out("Commands:");

  for (const commandResult of result.commandResults) {
    const exitCode = commandResult.result.exitCode === null ? "null" : String(commandResult.result.exitCode);
    out(`  - [${commandResult.stage}] ${commandResult.command}`);
    out(`    exit=${exitCode} timedOut=${String(commandResult.result.timedOut)} duration=${commandResult.result.durationMs}ms`);

    if (commandResult.result.stdout.trim().length > 0) {
      out("    stdout:");
      out(indent(commandResult.result.stdout.trim(), 6));
    }

    if (commandResult.result.stderr.trim().length > 0) {
      out("    stderr:");
      out(indent(commandResult.result.stderr.trim(), 6));
    }
  }

  if (result.commandResults.length === 0) {
    out("  (none)");
  }

  out("");
  out(`Risk findings: ${result.riskFindings.length}`);

  if (result.riskFindings.length === 0) {
    out("  (none)");
  } else {
    for (const finding of result.riskFindings) {
      out(`  - [${finding.level}] ${finding.id}${finding.file === undefined ? "" : ` ${finding.file}`}: ${finding.message}`);
    }
  }
}

function indent(value: string, spaces = 2): string {
  const prefix = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}
