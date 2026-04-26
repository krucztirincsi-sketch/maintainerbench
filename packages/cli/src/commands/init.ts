import { Command } from "commander";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create starter MaintainerBench files for a repository.")
    .option("-d, --dir <path>", "Repository directory to initialize.", ".")
    .action((options: { dir: string }) => {
      console.log(`maintainerbench init placeholder: would initialize ${options.dir}`);
    });
}
