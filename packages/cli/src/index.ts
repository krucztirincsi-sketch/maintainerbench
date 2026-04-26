#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Command } from "commander";
import { registerEvalCommand } from "./commands/eval.js";
import { registerInitCommand } from "./commands/init.js";
import { registerLintCommand } from "./commands/lint.js";
import { registerReportCommand } from "./commands/report.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("maintainerbench")
    .description("Guardrails and benchmark reports for maintainers adopting AI coding agents.")
    .version("0.1.0");

  registerInitCommand(program);
  registerLintCommand(program);
  registerEvalCommand(program);
  registerReportCommand(program);

  return program;
}

export async function main(argv: readonly string[] = process.argv): Promise<void> {
  await createProgram().parseAsync(argv);
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
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
