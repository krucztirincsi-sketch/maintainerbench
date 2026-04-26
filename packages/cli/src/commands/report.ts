import { Command } from "commander";

export function registerReportCommand(program: Command): void {
  program
    .command("report")
    .description("Render Markdown or JSON reports from MaintainerBench results.")
    .option("-f, --format <format>", "Report format: markdown or json.", "markdown")
    .action((options: { format: string }) => {
      console.log(`maintainerbench report placeholder: would render ${options.format}`);
    });
}
