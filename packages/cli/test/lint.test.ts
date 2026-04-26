import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createProgram } from "../src/index.js";
import { runLintCommand, type LintFinding } from "../src/commands/lint.js";

describe("maintainerbench lint", () => {
  it("passes a clean repository fixture", async () => {
    const result = await lintFixture("clean");

    expect(result.summary).toEqual({ info: 0, warning: 0, high: 0 });
    expect(result.findings).toEqual([]);
    expect(result.checkedFiles).toEqual([
      ".agents/skills/code-change-verification/SKILL.md",
      ".github/workflows/maintainerbench.yml",
      ".maintainerbench/config.yml",
      "AGENTS.md"
    ]);
  });

  it("reports missing AGENTS.md as high severity", async () => {
    const result = await lintFixture("missing-agents");

    expect(result.summary).toEqual({ info: 0, warning: 0, high: 1 });
    expect(result.findings).toEqual([
      {
        id: "agents.missing",
        severity: "high",
        file: "AGENTS.md",
        message: "AGENTS.md is required for repository-level AI-agent guidance."
      }
    ]);
  });

  it("reports missing setup/build/test guidance as warning severity", async () => {
    const result = await lintFixture("missing-guidance");

    expect(result.summary).toEqual({ info: 0, warning: 1, high: 0 });
    expect(result.findings).toEqual([
      {
        id: "agents.missing-verification-guidance",
        severity: "warning",
        file: "AGENTS.md",
        message: "AGENTS.md should include setup, build, and test instructions."
      }
    ]);
  });

  it.each([
    ["dangerous-command.rm-rf", "rm -rf"],
    ["dangerous-command.curl-pipe-sh", "curl ... | sh"],
    ["dangerous-command.wget-pipe-sh", "wget ... | sh"],
    ["dangerous-command.chmod-777", "chmod 777"]
  ])("reports dangerous command %s for %s as high severity", async (id) => {
    const result = await lintFixture("unsafe-patterns");

    expect(findFinding(result.findings, id)).toMatchObject({
      id,
      severity: "high",
      file: ".github/workflows/unsafe.yml"
    });
  });

  it("detects likely secret paths as high severity", async () => {
    const result = await lintFixture("unsafe-patterns");

    expect(findFinding(result.findings, "secret-path.dotenv")).toMatchObject({
      id: "secret-path.dotenv",
      severity: "high",
      file: ".github/workflows/unsafe.yml"
    });
    expect(findFinding(result.findings, "secret-path.secrets-directory")).toMatchObject({
      id: "secret-path.secrets-directory",
      severity: "high",
      file: ".github/workflows/unsafe.yml"
    });
    expect(findFinding(result.findings, "secret-path.credentials")).toMatchObject({
      id: "secret-path.credentials",
      severity: "high",
      file: ".github/workflows/unsafe.yml"
    });
    expect(findFinding(result.findings, "secret-path.id-rsa")).toMatchObject({
      id: "secret-path.id-rsa",
      severity: "high",
      file: ".github/workflows/unsafe.yml"
    });
    expect(findFinding(result.findings, "secret-path.private-key")).toMatchObject({
      id: "secret-path.private-key",
      severity: "high",
      file: ".github/workflows/unsafe.yml"
    });
  });

  it("reports invalid SKILL.md frontmatter as warning severity", async () => {
    const result = await lintFixture("invalid-skill-frontmatter");

    expect(result.summary).toEqual({ info: 0, warning: 1, high: 0 });
    expect(result.findings[0]).toMatchObject({
      id: "skill.invalid-frontmatter",
      severity: "warning",
      file: ".agents/skills/broken/SKILL.md"
    });
  });

  it("emits parseable JSON output with --json", async () => {
    const output: string[] = [];

    await runLintCommand({
      cwd: fixturePath("clean"),
      json: true,
      out: (line) => output.push(line)
    });

    const parsed = JSON.parse(output.join("\n")) as {
      summary: { info: number; warning: number; high: number };
      checkedFiles: string[];
      findings: unknown[];
    };

    expect(parsed.summary).toEqual({ info: 0, warning: 0, high: 0 });
    expect(parsed.checkedFiles).toContain("AGENTS.md");
    expect(parsed.findings).toEqual([]);
  });

  it("sets a non-zero exit code when high severity findings exist", async () => {
    const previousExitCode = process.exitCode;
    const program = createProgram();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    program.configureOutput({
      writeOut: () => undefined,
      writeErr: () => undefined
    });

    try {
      process.exitCode = undefined;
      await program.parseAsync(["node", "maintainerbench", "lint", fixturePath("unsafe-patterns")]);
      expect(process.exitCode).toBe(1);
    } finally {
      logSpy.mockRestore();
      process.exitCode = previousExitCode;
    }
  });
});

async function lintFixture(name: string) {
  return runLintCommand({ cwd: fixturePath(name), out: () => undefined });
}

function fixturePath(name: string): string {
  return fileURLToPath(new URL(`fixtures/lint/${name}/`, import.meta.url));
}

function findFinding(findings: readonly LintFinding[], id: string): LintFinding | undefined {
  return findings.find((finding) => finding.id === id);
}
