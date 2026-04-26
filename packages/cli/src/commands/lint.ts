import { Command } from "commander";

export function registerLintCommand(program: Command): void {
  program
    .command("lint")
    .description("Lint agent instructions, skills, MCP config, and workflow files.")
    .argument("[path]", "Repository path to lint.", ".")
    .action((targetPath: string) => {
      console.log(`maintainerbench lint placeholder: would inspect ${targetPath}`);
    });
}
