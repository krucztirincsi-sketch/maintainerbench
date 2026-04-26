import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runLintCommand } from "../src/commands/lint.js";

describe("maintainerbench lint", () => {
  it("passes a clean repository fixture", async () => {
    const repo = await createTempRepo();
    await writeCleanFixture(repo);
    await writeFixtureFile(repo, ".codex", "codex marker file\n");

    const result = await runLintCommand({ cwd: repo, out: () => undefined });

    expect(result.summary).toEqual({ info: 0, warning: 0, high: 0 });
    expect(result.findings).toEqual([]);
    expect(result.checkedFiles).toEqual([
      ".agents/skills/code-change-verification/SKILL.md",
      ".github/workflows/maintainerbench.yml",
      "AGENTS.md"
    ]);
  });

  it("reports missing AGENTS.md as high severity", async () => {
    const repo = await createTempRepo();

    const result = await runLintCommand({ cwd: repo, out: () => undefined });

    expect(result.summary.high).toBe(1);
    expect(result.findings).toContainEqual({
      id: "agents.missing",
      severity: "high",
      file: "AGENTS.md",
      message: "AGENTS.md is required for repository-level AI-agent guidance."
    });
  });

  it("reports dangerous commands as high severity", async () => {
    const repo = await createTempRepo();
    await writeCleanFixture(repo);
    await writeFile(
      path.join(repo, ".github/workflows/maintainerbench.yml"),
      `name: MaintainerBench
on: [pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: rm -rf .
`,
      "utf8"
    );

    const result = await runLintCommand({ cwd: repo, out: () => undefined });

    expect(result.summary.high).toBe(1);
    expect(result.findings.some((finding) => finding.id === "dangerous-command.rm-rf" && finding.severity === "high")).toBe(true);
  });

  it("reports invalid SKILL.md frontmatter as warning severity", async () => {
    const repo = await createTempRepo();
    await writeCleanFixture(repo);
    await writeFile(
      path.join(repo, ".agents/skills/code-change-verification/SKILL.md"),
      `# Code Change Verification

Use this skill when verifying code changes.
`,
      "utf8"
    );

    const result = await runLintCommand({ cwd: repo, out: () => undefined });

    expect(result.summary.high).toBe(0);
    expect(result.summary.warning).toBe(1);
    expect(result.findings).toContainEqual({
      id: "skill.missing-frontmatter",
      severity: "warning",
      file: ".agents/skills/code-change-verification/SKILL.md",
      message: "SKILL.md should start with YAML frontmatter containing name and description."
    });
  });

  it("emits parseable JSON output with --json", async () => {
    const repo = await createTempRepo();
    await writeCleanFixture(repo);
    const output: string[] = [];

    await runLintCommand({ cwd: repo, json: true, out: (line) => output.push(line) });

    const parsed = JSON.parse(output.join("\n")) as {
      summary: { info: number; warning: number; high: number };
      checkedFiles: string[];
      findings: unknown[];
    };

    expect(parsed.summary).toEqual({ info: 0, warning: 0, high: 0 });
    expect(parsed.checkedFiles).toContain("AGENTS.md");
    expect(parsed.findings).toEqual([]);
  });
});

async function createTempRepo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "maintainerbench-lint-"));
}

async function writeCleanFixture(repo: string): Promise<void> {
  await writeFixtureFile(
    repo,
    "AGENTS.md",
    `# Agent Instructions

## Setup

Run pnpm install --frozen-lockfile before development.

## Build

Run pnpm build.

## Test

Run pnpm test.

## Safety

Do not approve, merge, or auto-accept pull requests. Keep file writes inside this repository.
`
  );

  await writeFixtureFile(
    repo,
    ".agents/skills/code-change-verification/SKILL.md",
    `---
name: code-change-verification
description: Verify code changes with focused tests and required repository checks.
---

# Code Change Verification

Use this skill when verifying code changes.
`
  );

  await writeFixtureFile(
    repo,
    ".github/workflows/maintainerbench.yml",
    `name: MaintainerBench

on:
  pull_request:

permissions:
  contents: read
  pull-requests: read

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec maintainerbench lint
`
  );
}

async function writeFixtureFile(repo: string, relativePath: string, content: string): Promise<void> {
  const filePath = path.join(repo, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}
