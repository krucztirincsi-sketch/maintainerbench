import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

export interface VerificationCommand {
  readonly command: string;
  readonly args?: readonly string[];
  readonly cwd: string;
  readonly timeoutMs?: number;
  readonly env?: NodeJS.ProcessEnv;
}

export interface VerificationResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly durationMs: number;
  readonly signal: NodeJS.Signals | null;
}

export async function runVerificationCommand(command: VerificationCommand): Promise<VerificationResult> {
  if (command.command.trim().length === 0) {
    throw new Error("Command must not be empty.");
  }

  const startedAt = performance.now();

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    let timeout: NodeJS.Timeout | undefined;
    let closeResult: { readonly exitCode: number | null; readonly signal: NodeJS.Signals | null } | undefined;
    let stdoutEnded = false;
    let stderrEnded = false;

    const child = spawn(command.command, [...(command.args ?? [])], {
      cwd: command.cwd,
      env: command.env === undefined ? process.env : { ...process.env, ...command.env },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });

    const finish = (result: Omit<VerificationResult, "stdout" | "stderr" | "timedOut" | "durationMs">): void => {
      if (settled) {
        return;
      }

      settled = true;

      if (timeout !== undefined) {
        clearTimeout(timeout);
      }

      resolve({
        ...result,
        stdout,
        stderr,
        timedOut,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt))
      });
    };

    const maybeFinish = (): void => {
      if (closeResult !== undefined && stdoutEnded && stderrEnded) {
        finish(closeResult);
      }
    };

    if (child.stdout === null) {
      stdoutEnded = true;
    } else {
      child.stdout.setEncoding("utf8");

      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });

      child.stdout.on("end", () => {
        stdoutEnded = true;
        maybeFinish();
      });
    }

    if (child.stderr === null) {
      stderrEnded = true;
    } else {
      child.stderr.setEncoding("utf8");

      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });

      child.stderr.on("end", () => {
        stderrEnded = true;
        maybeFinish();
      });
    }

    if (command.timeoutMs !== undefined) {
      timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, command.timeoutMs);
    }

    child.on("error", (error: Error) => {
      stderr += stderr.length === 0 ? error.message : `\n${error.message}`;
      finish({ exitCode: null, signal: null });
    });

    child.on("close", (exitCode: number | null, signal: NodeJS.Signals | null) => {
      closeResult = { exitCode, signal };
      maybeFinish();
    });
  });
}
