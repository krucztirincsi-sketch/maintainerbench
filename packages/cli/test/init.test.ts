import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runInitCommand } from "../src/commands/init.js";
import { parseBenchmarkTaskYaml } from "../src/core/task-schema.js";

const generatedPaths = [
  "AGENTS.md",
  ".maintainerbench/config.yml",
  ".maintainerbench/tasks/example-bugfix.yml",
  ".agents/skills/code-change-verification/SKILL.md",
  ".agents/skills/pr-review/SKILL.md",
  ".agents/skills/docs-sync/SKILL.md",
  ".github/workflows/maintainerbench.yml"
] as const;

const generatedSkillTemplates = [
  {
    generatedPath: ".agents/skills/code-change-verification/SKILL.md",
    templatePath: "skills/code-change-verification/SKILL.md",
    name: "code-change-verification"
  },
  {
    generatedPath: ".agents/skills/pr-review/SKILL.md",
    templatePath: "skills/pr-review/SKILL.md",
    name: "pr-review"
  },
  {
    generatedPath: ".agents/skills/docs-sync/SKILL.md",
    templatePath: "skills/docs-sync/SKILL.md",
    name: "docs-sync"
  }
] as const;

describe("maintainerbench init", () => {
  it("creates starter files in the current repository", async () => {
    const repo = await createTempRepo();
    const output: string[] = [];

    const result = await runInitCommand({ cwd: repo, out: (line) => output.push(line) });

    expect(result.files.map((file) => file.status)).toEqual(generatedPaths.map(() => "created"));

    for (const generatedPath of generatedPaths) {
      expect(await pathExists(path.join(repo, generatedPath))).toBe(true);
    }

    const agents = await readFile(path.join(repo, "AGENTS.md"), "utf8");
    expect(agents).toContain("# Repository Agent Instructions");
    expect(agents).toContain("Do not approve, merge, or auto-accept pull requests.");

    const taskSource = await readFile(path.join(repo, ".maintainerbench/tasks/example-bugfix.yml"), "utf8");
    const task = parseBenchmarkTaskYaml(taskSource);
    expect(task.id).toBe("example-bugfix");
    expect(task.verify).toEqual([{ run: "pnpm test", timeoutSeconds: 120 }]);

    for (const skillTemplate of generatedSkillTemplates) {
      const generatedSkill = await readFile(path.join(repo, skillTemplate.generatedPath), "utf8");
      const sourceTemplate = await readTemplate(skillTemplate.templatePath);

      expect(generatedSkill).toBe(sourceTemplate);
      expect(generatedSkill).toContain(`name: ${skillTemplate.name}`);
      expect(generatedSkill).toContain("description:");
      expect(generatedSkill).toContain("## When To Use");
      expect(generatedSkill).toContain("## Workflow");
      expect(generatedSkill).toContain("## Safety Boundaries");
      expect(generatedSkill).toContain("## Examples");
      expect(generatedSkill.toLowerCase()).toContain("do not");
      expect(generatedSkill.toLowerCase()).toContain("guarantee");
    }

    const summary = output.join("\n");
    expect(summary).toContain("MaintainerBench init summary");
    expect(summary).toContain("Created files:");
    expect(summary).toContain("  - .github/workflows/maintainerbench.yml");
  });

  it("skips existing files without --force", async () => {
    const repo = await createTempRepo();
    const existingAgents = "# Existing instructions\n";
    await writeFile(path.join(repo, "AGENTS.md"), existingAgents, "utf8");

    const result = await runInitCommand({ cwd: repo, out: () => undefined });

    expect(await readFile(path.join(repo, "AGENTS.md"), "utf8")).toBe(existingAgents);
    expect(result.files.find((file) => file.path === "AGENTS.md")).toEqual({
      path: "AGENTS.md",
      status: "skipped",
      reason: "already exists; use --force to overwrite"
    });
    expect(result.files.filter((file) => file.status === "created")).toHaveLength(generatedPaths.length - 1);
  });

  it("overwrites existing files with --force", async () => {
    const repo = await createTempRepo();
    await writeFile(path.join(repo, "AGENTS.md"), "# Existing instructions\n", "utf8");

    const result = await runInitCommand({ cwd: repo, force: true, out: () => undefined });

    expect(await readFile(path.join(repo, "AGENTS.md"), "utf8")).toContain("# Repository Agent Instructions");
    expect(result.files.find((file) => file.path === "AGENTS.md")?.status).toBe("overwritten");
  });

  it("reports planned writes without creating files in --dry-run mode", async () => {
    const repo = await createTempRepo();
    const output: string[] = [];

    const result = await runInitCommand({ cwd: repo, dryRun: true, out: (line) => output.push(line) });

    expect(result.files.map((file) => file.status)).toEqual(generatedPaths.map(() => "would-create"));

    for (const generatedPath of generatedPaths) {
      expect(await pathExists(path.join(repo, generatedPath))).toBe(false);
    }

    const summary = output.join("\n");
    expect(summary).toContain("MaintainerBench init summary (dry run)");
    expect(summary).toContain("Would create files:");
    expect(summary).toContain("No files were written.");
  });
});

async function readTemplate(templatePath: string): Promise<string> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  return readFile(path.join(repoRoot, "templates", templatePath), "utf8");
}

async function createTempRepo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "maintainerbench-init-"));
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}
