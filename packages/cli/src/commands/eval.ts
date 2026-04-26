import { Command } from "commander";

export function registerEvalCommand(program: Command): void {
  program
    .command("eval")
    .description("Run benchmark tasks in isolated worktrees.")
    .option("-t, --tasks <path>", "Benchmark task YAML file.")
    .action((options: { tasks?: string }) => {
      const taskPath = options.tasks ?? "maintainerbench.tasks.yaml";
      console.log(`maintainerbench eval placeholder: would load ${taskPath}`);
    });
}
