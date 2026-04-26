import { realpathSync } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

type ActionMode = "lint" | "eval";
type FailOn = "warning" | "high" | "never";

interface ActionInputs {
  readonly mode: ActionMode;
  readonly task: string;
  readonly agentCommand: string;
  readonly failOn: FailOn;
}

interface LintSummary {
  readonly info: number;
  readonly warning: number;
  readonly high: number;
}

interface LintFinding {
  readonly id: string;
  readonly severity: "info" | "warning" | "high";
  readonly file: string;
  readonly line?: number;
  readonly message: string;
}

interface LintResult {
  readonly root: string;
  readonly checkedFiles: readonly string[];
  readonly findings: readonly LintFinding[];
  readonly summary: LintSummary;
}

interface CommandSpec {
  readonly command: string;
  readonly args: readonly string[];
}

interface CommandResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export interface RunActionOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly out?: (line: string) => void;
  readonly err?: (line: string) => void;
  readonly commandRunner?: (command: string, args: readonly string[], cwd: string) => Promise<CommandResult>;
  readonly cliCommand?: CommandSpec;
}

export interface ActionRunResult {
  readonly failed: boolean;
  readonly message: string;
  readonly lintResult: LintResult;
}

export async function run(): Promise<void> {
  const result = await runAction();

  if (result.failed) {
    console.error(`::error::${escapeWorkflowCommand(result.message)}`);
    process.exitCode = 1;
  }
}

export async function runAction(options: RunActionOptions = {}): Promise<ActionRunResult> {
  const env = options.env ?? process.env;
  const out = options.out ?? ((line: string) => console.log(line));
  const err = options.err ?? ((line: string) => console.error(line));
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const inputs = readInputs(env);

  out("MaintainerBench GitHub Action");
  out(`Mode: ${inputs.mode}`);
  out(`Fail on: ${inputs.failOn}`);

  if (inputs.mode === "eval") {
    throw new Error(
      "mode=eval is not supported in the MaintainerBench GitHub Action yet. The v0.1 action never runs agent commands or model APIs."
    );
  }

  if (inputs.task.length > 0) {
    out("Task input is ignored in lint mode.");
  }

  if (inputs.agentCommand.length > 0) {
    out("Agent command input is ignored in lint mode; this GitHub Action does not run agent commands.");
  }

  const cliCommand = options.cliCommand ?? (await resolveCliCommand(import.meta.url));
  const commandRunner = options.commandRunner ?? runCommand;

  out(`Running: ${formatCommand(cliCommand)}`);

  const commandResult = await commandRunner(cliCommand.command, cliCommand.args, cwd);

  if (commandResult.stderr.trim().length > 0) {
    err(commandResult.stderr.trim());
  }

  const lintResult = parseLintResult(commandResult.stdout);
  printLintSummary(lintResult, out);

  if (commandResult.exitCode !== 0 && lintResult.summary.high === 0) {
    throw new Error(`MaintainerBench lint command failed with exit code ${formatExitCode(commandResult.exitCode)}.`);
  }

  const failed = shouldFail(lintResult.summary, inputs.failOn);
  const message = failed
    ? `MaintainerBench lint found ${formatSummary(lintResult.summary)} and fail-on is ${inputs.failOn}.`
    : `MaintainerBench lint completed with ${formatSummary(lintResult.summary)}.`;

  out(`Conclusion: ${failed ? "failed" : "passed"}`);
  out(message);

  return {
    failed,
    message,
    lintResult
  };
}

export function readInputs(env: NodeJS.ProcessEnv = process.env): ActionInputs {
  const mode = parseMode(readInput(env, "mode", "lint"));
  const failOn = parseFailOn(readInput(env, "fail-on", "high"));

  return {
    mode,
    task: readInput(env, "task", ""),
    agentCommand: readInput(env, "agent-command", ""),
    failOn
  };
}

export async function resolveCliCommand(moduleUrl: string): Promise<CommandSpec> {
  const actionDistDirectory = path.dirname(fileURLToPath(moduleUrl));
  const cliEntrypoint = path.resolve(actionDistDirectory, "../../cli/dist/index.js");

  try {
    await access(cliEntrypoint);
    return {
      command: process.execPath,
      args: [cliEntrypoint, "lint", "--json"]
    };
  } catch {
    return {
      command: "pnpm",
      args: ["exec", "maintainerbench", "lint", "--json"]
    };
  }
}

function readInput(env: NodeJS.ProcessEnv, name: string, fallback: string): string {
  const key = `INPUT_${name.replace(/-/g, "_").toUpperCase()}`;
  const value = env[key]?.trim();

  return value === undefined || value.length === 0 ? fallback : value;
}

function parseMode(value: string): ActionMode {
  if (value === "lint" || value === "eval") {
    return value;
  }

  throw new Error(`Invalid mode input: ${value}. Expected lint or eval.`);
}

function parseFailOn(value: string): FailOn {
  if (value === "warning" || value === "high" || value === "never") {
    return value;
  }

  throw new Error(`Invalid fail-on input: ${value}. Expected warning, high, or never.`);
}

function parseLintResult(stdout: string): LintResult {
  try {
    const parsed = JSON.parse(stdout.trim()) as unknown;

    if (!isLintResult(parsed)) {
      throw new Error("JSON shape did not match MaintainerBench lint output.");
    }

    return parsed;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not parse MaintainerBench lint JSON output: ${message}`);
  }
}

function isLintResult(value: unknown): value is LintResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as {
    readonly root?: unknown;
    readonly checkedFiles?: unknown;
    readonly findings?: unknown;
    readonly summary?: unknown;
  };
  const summary = candidate.summary as
    | {
        readonly info?: unknown;
        readonly warning?: unknown;
        readonly high?: unknown;
      }
    | undefined;

  return (
    typeof candidate.root === "string" &&
    Array.isArray(candidate.checkedFiles) &&
    Array.isArray(candidate.findings) &&
    typeof summary === "object" &&
    summary !== null &&
    typeof summary.info === "number" &&
    typeof summary.warning === "number" &&
    typeof summary.high === "number"
  );
}

function printLintSummary(result: LintResult, out: (line: string) => void): void {
  out(`Checked files: ${result.checkedFiles.length}`);
  out(`Findings: ${formatSummary(result.summary)}`);

  if (result.findings.length === 0) {
    out("No lint findings.");
    return;
  }

  out("Lint findings:");

  for (const finding of result.findings) {
    const location = finding.line === undefined ? finding.file : `${finding.file}:${String(finding.line)}`;
    out(`- [${finding.severity}] ${location} ${finding.id}: ${finding.message}`);
  }
}

function shouldFail(summary: LintSummary, failOn: FailOn): boolean {
  switch (failOn) {
    case "warning":
      return summary.warning > 0 || summary.high > 0;
    case "high":
      return summary.high > 0;
    case "never":
      return false;
  }
}

function formatSummary(summary: LintSummary): string {
  return `${String(summary.info)} info, ${String(summary.warning)} warning, ${String(summary.high)} high`;
}

function formatCommand(command: CommandSpec): string {
  return [command.command, ...command.args].join(" ");
}

function formatExitCode(exitCode: number | null): string {
  return exitCode === null ? "null" : String(exitCode);
}

async function runCommand(command: string, args: readonly string[], cwd: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      [...args],
      {
        cwd,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        shell: false
      },
      (error, stdout, stderr) => {
        if (error === null) {
          resolve({
            exitCode: 0,
            stdout,
            stderr
          });
          return;
        }

        const errorCode = (error as NodeJS.ErrnoException).code;

        if (typeof errorCode !== "number") {
          reject(error);
          return;
        }

        resolve({
          exitCode: errorCode,
          stdout,
          stderr
        });
      }
    );
  });
}

function escapeWorkflowCommand(value: string): string {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

function isDirectRun(moduleUrl: string): boolean {
  const entrypoint = process.argv[1];

  if (entrypoint === undefined) {
    return false;
  }

  try {
    return realpathSync(entrypoint) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return pathToFileURL(entrypoint).href === moduleUrl;
  }
}

if (isDirectRun(import.meta.url)) {
  run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`::error::${escapeWorkflowCommand(message)}`);
    process.exitCode = 1;
  });
}
