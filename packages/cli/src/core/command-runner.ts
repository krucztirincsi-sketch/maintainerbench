export interface VerificationCommand {
  readonly command: string;
  readonly args?: readonly string[];
  readonly cwd: string;
  readonly timeoutMs?: number;
}

export interface VerificationResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
}

export async function runVerificationCommand(command: VerificationCommand): Promise<VerificationResult> {
  void command;
  throw new Error("Verification command execution is not implemented yet.");
}
