import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runLintCommand } from "../src/commands/lint.js";
import { parseBenchmarkTaskYaml } from "../src/core/task-schema.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const exampleTaskPaths = [
  "examples/ts-library/.maintainerbench/tasks/add-multiply-helper.yml",
  "examples/python-package/.maintainerbench/tasks/add-subtract-helper.yml"
] as const;

describe("example MaintainerBench tasks", () => {
  it("keeps example task YAML valid and test-focused", async () => {
    for (const taskPath of exampleTaskPaths) {
      const task = parseBenchmarkTaskYaml(await readFile(path.join(repoRoot, taskPath), "utf8"));

      expect(task.id).toMatch(/^[a-z0-9-]+$/);
      expect(task.title.length).toBeGreaterThan(0);
      expect(task.verify.length).toBeGreaterThan(0);
      expect(task.risk.require_tests).toBe(true);
      expect(task.risk.max_files_changed).toBeGreaterThan(0);
    }
  });

  it("keeps the TypeScript library demo runnable and lint-clean", async () => {
    const readme = await readFile(path.join(repoRoot, "examples/ts-library/README.md"), "utf8");

    expect(readme).toContain("pnpm --filter @maintainerbench/example-ts-library test");
    expect(readme).toContain("pnpm exec maintainerbench lint examples/ts-library");
    expect(readme).toContain("--agent-command \"node examples/fake-agents/add-ts-multiply.mjs\"");
    expect(readme).toContain("final status should be `pass`");

    const lintResult = await runLintCommand({
      cwd: repoRoot,
      targetPath: "examples/ts-library",
      out: () => undefined
    });

    expect(lintResult.checkedFiles).toEqual([".maintainerbench/config.yml", "AGENTS.md"]);
    expect(lintResult.summary).toEqual({
      info: 0,
      warning: 0,
      high: 0
    });
  });
});
