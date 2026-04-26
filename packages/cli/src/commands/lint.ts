import { constants } from "node:fs";
import { access, readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { parse as parseYaml } from "yaml";

export type LintSeverity = "info" | "warning" | "high";

export interface LintFinding {
  readonly id: string;
  readonly severity: LintSeverity;
  readonly file: string;
  readonly line?: number;
  readonly message: string;
}

export interface LintSummary {
  readonly info: number;
  readonly warning: number;
  readonly high: number;
}

export interface LintResult {
  readonly root: string;
  readonly checkedFiles: readonly string[];
  readonly findings: readonly LintFinding[];
  readonly summary: LintSummary;
}

export interface RunLintOptions {
  readonly cwd?: string;
  readonly targetPath?: string;
  readonly json?: boolean;
  readonly out?: (line: string) => void;
}

interface InspectedFile {
  readonly relativePath: string;
  readonly content: string;
}

interface PatternRule {
  readonly id: string;
  readonly severity: LintSeverity;
  readonly message: string;
  readonly pattern: RegExp;
}

const workflowAndConfigPaths = new Set([
  ".codex/config.toml",
  ".mcp.json",
  "mcp.json",
  ".maintainerbench/config.yml"
]);

const dangerousCommandRules: readonly PatternRule[] = [
  {
    id: "dangerous-command.rm-rf",
    severity: "high",
    message: "Avoid recursive force deletion in agent instructions or workflows.",
    pattern: /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\b|\brm\s+-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*\b/i
  },
  {
    id: "dangerous-command.curl-pipe-sh",
    severity: "high",
    message: "Do not pipe remote curl downloads directly into a shell.",
    pattern: /\bcurl\b[^\n|]*(?:\n[^\n|]*)?\|\s*(?:sh|bash)\b/i
  },
  {
    id: "dangerous-command.wget-pipe-sh",
    severity: "high",
    message: "Do not pipe remote wget downloads directly into a shell.",
    pattern: /\bwget\b[^\n|]*(?:\n[^\n|]*)?\|\s*(?:sh|bash)\b/i
  },
  {
    id: "dangerous-command.chmod-777",
    severity: "high",
    message: "Avoid chmod 777 because it grants broad write permissions.",
    pattern: /\bchmod\b[^\n]*\b777\b/i
  },
  {
    id: "dangerous-command.sudo",
    severity: "high",
    message: "Avoid sudo in agent instructions or workflows.",
    pattern: /\bsudo\b/i
  },
  {
    id: "dangerous-command.dd-if",
    severity: "high",
    message: "Avoid dd commands that read from an if= source.",
    pattern: /\bdd\b[^\n]*\bif=/i
  },
  {
    id: "dangerous-command.mkfs",
    severity: "high",
    message: "Avoid filesystem formatting commands.",
    pattern: /\bmkfs(?:\.[a-z0-9_-]+)?\b/i
  },
  {
    id: "dangerous-command.fork-bomb",
    severity: "high",
    message: "Do not include shell fork bomb patterns.",
    pattern: /:\s*\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/i
  }
];

const secretPathRules: readonly PatternRule[] = [
  {
    id: "secret-path.dotenv",
    severity: "high",
    message: "Likely secret path reference: .env.",
    pattern: /(^|[/"'`\s])\.env(?:$|[/"'`\s])/im
  },
  {
    id: "secret-path.id-rsa",
    severity: "high",
    message: "Likely private SSH key reference: id_rsa.",
    pattern: /\bid_rsa\b/i
  },
  {
    id: "secret-path.private-key",
    severity: "high",
    message: "Likely private key reference.",
    pattern: /\bprivate_key\b/i
  },
  {
    id: "secret-path.secrets-directory",
    severity: "high",
    message: "Likely secrets directory reference.",
    pattern: /(^|[/"'`\s])secrets\/+/i
  },
  {
    id: "secret-path.credentials",
    severity: "high",
    message: "Likely credentials reference.",
    pattern: /\bcredentials\b/i
  }
];

const unpinnedInstallRules: readonly PatternRule[] = [
  {
    id: "install.unpinned-npm-install",
    severity: "warning",
    message: "Prefer npm ci or package-lock guidance over npm install in automation.",
    pattern: /\bnpm\s+install\b(?![^\n]*(?:package-lock|npm-shrinkwrap|--package-lock))/i
  },
  {
    id: "install.unpinned-pnpm-install",
    severity: "warning",
    message: "Prefer pnpm install --frozen-lockfile in automation.",
    pattern: /\bpnpm\s+install\b(?![^\n]*--frozen-lockfile)/i
  },
  {
    id: "install.unpinned-yarn-install",
    severity: "warning",
    message: "Prefer yarn install --immutable or --frozen-lockfile in automation.",
    pattern: /\byarn\s+install\b(?![^\n]*(?:--immutable|--frozen-lockfile))/i
  },
  {
    id: "install.unpinned-bun-install",
    severity: "warning",
    message: "Prefer bun install --frozen-lockfile in automation.",
    pattern: /\bbun\s+install\b(?![^\n]*--frozen-lockfile)/i
  }
];

const broadWritePermissionRules: readonly PatternRule[] = [
  {
    id: "workflow-permissions.write-all",
    severity: "high",
    message: "Avoid GitHub Actions permissions: write-all.",
    pattern: /^\s*permissions\s*:\s*write-all\s*$/im
  },
  {
    id: "workflow-permissions.contents-write",
    severity: "warning",
    message: "Workflow grants contents: write; keep write permissions as narrow as possible.",
    pattern: /^\s*contents\s*:\s*write\s*$/im
  },
  {
    id: "workflow-permissions.pull-requests-write",
    severity: "warning",
    message: "Workflow grants pull-requests: write; MaintainerBench should not approve or merge pull requests.",
    pattern: /^\s*pull-requests\s*:\s*write\s*$/im
  },
  {
    id: "workflow-permissions.actions-write",
    severity: "warning",
    message: "Workflow grants actions: write; keep write permissions as narrow as possible.",
    pattern: /^\s*actions\s*:\s*write\s*$/im
  },
  {
    id: "workflow-permissions.issues-write",
    severity: "warning",
    message: "Workflow grants issues: write; keep write permissions as narrow as possible.",
    pattern: /^\s*issues\s*:\s*write\s*$/im
  },
  {
    id: "workflow-permissions.packages-write",
    severity: "warning",
    message: "Workflow grants packages: write; keep write permissions as narrow as possible.",
    pattern: /^\s*packages\s*:\s*write\s*$/im
  }
];

export function registerLintCommand(program: Command): void {
  program
    .command("lint")
    .description("Lint agent instructions, skills, MCP config, and workflow files.")
    .argument("[path]", "Repository path to lint.", ".")
    .option("--json", "Emit machine-readable JSON output.")
    .action(async (targetPath: string, options: { json?: boolean }) => {
      const result = await runLintCommand({
        targetPath,
        json: options.json === true
      });

      if (result.summary.high > 0) {
        process.exitCode = 1;
      }
    });
}

export async function runLintCommand(options: RunLintOptions = {}): Promise<LintResult> {
  const root = await resolveLintRoot(options.cwd ?? process.cwd(), options.targetPath ?? ".");
  const files = await collectInspectedFiles(root);
  const findings = collectFindings(files);

  if (!files.some((file) => file.relativePath === "AGENTS.md")) {
    findings.push({
      id: "agents.missing",
      severity: "high",
      file: "AGENTS.md",
      message: "AGENTS.md is required for repository-level AI-agent guidance."
    });
  }

  const result: LintResult = {
    root,
    checkedFiles: files.map((file) => file.relativePath).sort(),
    findings: findings.sort(compareFindings),
    summary: summarizeFindings(findings)
  };

  const out = options.out ?? ((line: string) => console.log(line));

  if (options.json === true) {
    out(JSON.stringify(result, null, 2));
  } else {
    printHumanReadableLintResult(result, out);
  }

  return result;
}

async function resolveLintRoot(cwd: string, targetPath: string): Promise<string> {
  const base = await realpath(path.resolve(cwd));
  const requestedPath = path.resolve(base, targetPath);
  const relativePath = path.relative(base, requestedPath);

  if (relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to lint a path outside the current working directory: ${targetPath}`);
  }

  const target = await realpath(requestedPath);
  const targetRelativePath = path.relative(base, target);

  if (targetRelativePath === ".." || targetRelativePath.startsWith(`..${path.sep}`) || path.isAbsolute(targetRelativePath)) {
    throw new Error(`Refusing to lint a path outside the current working directory: ${targetPath}`);
  }

  const targetStat = await stat(target);

  if (!targetStat.isDirectory()) {
    throw new Error(`Lint target must be a directory: ${targetPath}`);
  }

  return target;
}

async function collectInspectedFiles(root: string): Promise<InspectedFile[]> {
  const files: InspectedFile[] = [];
  const candidates = [
    "AGENTS.md",
    ".codex/config.toml",
    ".mcp.json",
    "mcp.json",
    ".maintainerbench/config.yml"
  ];

  for (const candidate of candidates) {
    const file = await readInspectedFileIfPresent(root, candidate);

    if (file !== undefined) {
      files.push(file);
    }
  }

  for (const skillPath of await findSkillFiles(root)) {
    const file = await readInspectedFileIfPresent(root, skillPath);

    if (file !== undefined) {
      files.push(file);
    }
  }

  for (const workflowPath of await findWorkflowFiles(root)) {
    const file = await readInspectedFileIfPresent(root, workflowPath);

    if (file !== undefined) {
      files.push(file);
    }
  }

  return files.sort((first, second) => first.relativePath.localeCompare(second.relativePath));
}

async function readInspectedFileIfPresent(root: string, relativePath: string): Promise<InspectedFile | undefined> {
  const absolutePath = path.join(root, relativePath);
  const safePath = await getSafeExistingFilePath(root, absolutePath);

  if (safePath === undefined) {
    return undefined;
  }

  return {
    relativePath,
    content: await readFile(safePath, "utf8")
  };
}

async function getSafeExistingFilePath(root: string, absolutePath: string): Promise<string | undefined> {
  try {
    await access(absolutePath, constants.R_OK);
  } catch (error: unknown) {
    if (isMissingPathError(error)) {
      return undefined;
    }

    throw error;
  }

  const resolvedPath = await realpath(absolutePath);
  const relativePath = path.relative(root, resolvedPath);

  if (relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to read a file outside the lint root: ${absolutePath}`);
  }

  const fileStat = await stat(resolvedPath);

  if (!fileStat.isFile()) {
    return undefined;
  }

  return resolvedPath;
}

async function findSkillFiles(root: string): Promise<string[]> {
  return findFiles(root, ".agents", (relativePath) => path.basename(relativePath) === "SKILL.md");
}

async function findWorkflowFiles(root: string): Promise<string[]> {
  return findFiles(root, ".github/workflows", (relativePath) => /\.ya?ml$/i.test(relativePath));
}

async function findFiles(
  root: string,
  startDirectory: string,
  shouldInclude: (relativePath: string) => boolean
): Promise<string[]> {
  const directory = path.join(root, startDirectory);

  try {
    const directoryStat = await stat(directory);

    if (!directoryStat.isDirectory()) {
      return [];
    }

    const resolvedDirectory = await realpath(directory);
    const relativePath = path.relative(root, resolvedDirectory);

    if (relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
      throw new Error(`Refusing to scan a directory outside the lint root: ${directory}`);
    }
  } catch (error: unknown) {
    if (isMissingPathError(error)) {
      return [];
    }

    throw error;
  }

  const results: string[] = [];
  await collectFilesRecursively(root, directory, shouldInclude, results);

  return results.sort();
}

async function collectFilesRecursively(
  root: string,
  directory: string,
  shouldInclude: (relativePath: string) => boolean,
  results: string[]
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await collectFilesRecursively(root, absolutePath, shouldInclude, results);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const relativePath = toPosixPath(path.relative(root, absolutePath));

    if (shouldInclude(relativePath)) {
      results.push(relativePath);
    }
  }
}

function collectFindings(files: readonly InspectedFile[]): LintFinding[] {
  const findings: LintFinding[] = [];
  const agentsFile = files.find((file) => file.relativePath === "AGENTS.md");

  if (agentsFile !== undefined) {
    findings.push(...checkAgentsGuidance(agentsFile));
  }

  for (const file of files) {
    if (file.relativePath.endsWith("/SKILL.md")) {
      findings.push(...checkSkillFrontmatter(file));
    }

    findings.push(...checkDangerousCommandRules(file));
    findings.push(...checkSecretPathRules(file));

    if (isWorkflowOrConfigFile(file.relativePath)) {
      findings.push(...checkPatternRules(file, broadWritePermissionRules));
      findings.push(...checkPatternRules(file, unpinnedInstallRules));
    }
  }

  return findings;
}

function checkAgentsGuidance(file: InspectedFile): LintFinding[] {
  const findings: LintFinding[] = [];

  if (!includesSetupBuildAndTestGuidance(file.content)) {
    findings.push({
      id: "agents.missing-verification-guidance",
      severity: "warning",
      file: file.relativePath,
      message: "AGENTS.md should include setup, build, and test instructions."
    });
  }

  if (!includesSafetyGuidance(file.content)) {
    findings.push({
      id: "agents.missing-safety-guidance",
      severity: "warning",
      file: file.relativePath,
      message: "AGENTS.md should include safety or security guidance for AI coding agents."
    });
  }

  return findings;
}

function includesSetupBuildAndTestGuidance(content: string): boolean {
  const normalized = content.toLowerCase();
  const hasSetup = /\b(setup|install|bootstrap|getting started)\b/.test(normalized);
  const hasBuild = /\b(build|compile|typecheck|tsc)\b/.test(normalized);
  const hasTest = /\b(test|vitest|jest|pytest|cargo test|go test)\b/.test(normalized);

  return hasSetup && hasBuild && hasTest;
}

function includesSafetyGuidance(content: string): boolean {
  return /\b(safety|security|secret|credential|ssh key|dangerous|do not|never|must not|avoid)\b/i.test(content);
}

function checkSkillFrontmatter(file: InspectedFile): LintFinding[] {
  const frontmatter = parseFrontmatter(file.content);

  if (frontmatter === undefined) {
    return [
      {
        id: "skill.missing-frontmatter",
        severity: "warning",
        file: file.relativePath,
        message: "SKILL.md should start with YAML frontmatter containing name and description."
      }
    ];
  }

  if (frontmatter instanceof Error) {
    return [
      {
        id: "skill.invalid-frontmatter",
        severity: "warning",
        file: file.relativePath,
        message: `SKILL.md frontmatter could not be parsed: ${frontmatter.message}`
      }
    ];
  }

  const name = frontmatter["name"];
  const description = frontmatter["description"];
  const findings: LintFinding[] = [];

  if (typeof name !== "string" || name.trim().length === 0) {
    findings.push({
      id: "skill.missing-name",
      severity: "warning",
      file: file.relativePath,
      message: "SKILL.md frontmatter should include a non-empty name."
    });
  }

  if (typeof description !== "string" || description.trim().length === 0) {
    findings.push({
      id: "skill.missing-description",
      severity: "warning",
      file: file.relativePath,
      message: "SKILL.md frontmatter should include a non-empty description."
    });
  }

  return findings;
}

function parseFrontmatter(content: string): Record<string, unknown> | Error | undefined {
  if (!content.startsWith("---\n")) {
    return undefined;
  }

  const endIndex = content.indexOf("\n---", 4);

  if (endIndex === -1) {
    return new Error("missing closing --- marker");
  }

  try {
    const parsed = parseYaml(content.slice(4, endIndex));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch (error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

function checkPatternRules(file: InspectedFile, rules: readonly PatternRule[]): LintFinding[] {
  const findings: LintFinding[] = [];

  for (const rule of rules) {
    const match = rule.pattern.exec(file.content);

    if (match === null) {
      continue;
    }

    findings.push({
      id: rule.id,
      severity: rule.severity,
      file: file.relativePath,
      line: getLineNumber(file.content, match.index),
      message: rule.message
    });
  }

  return findings;
}

function checkDangerousCommandRules(file: InspectedFile): LintFinding[] {
  const findings: LintFinding[] = [];

  for (const rule of dangerousCommandRules) {
    const match = rule.pattern.exec(file.content);

    if (match === null || isSafetyOnlyReference(file.content, match.index)) {
      continue;
    }

    findings.push({
      id: rule.id,
      severity: rule.severity,
      file: file.relativePath,
      line: getLineNumber(file.content, match.index),
      message: rule.message
    });
  }

  return findings;
}

function checkSecretPathRules(file: InspectedFile): LintFinding[] {
  const findings: LintFinding[] = [];

  for (const rule of secretPathRules) {
    const match = rule.pattern.exec(file.content);

    if (match === null || isSafetyOnlyReference(file.content, match.index)) {
      continue;
    }

    findings.push({
      id: rule.id,
      severity: rule.severity,
      file: file.relativePath,
      line: getLineNumber(file.content, match.index),
      message: rule.message
    });
  }

  return findings;
}

function isSafetyOnlyReference(content: string, index: number): boolean {
  const lineStart = content.lastIndexOf("\n", index) + 1;
  const lineEnd = content.indexOf("\n", index);
  const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd).toLowerCase();

  return /\b(do not|don't|never|avoid|forbid|refuse|block|flag|detect|look for|treat|high risk|security|safety)\b/.test(line);
}

function isWorkflowOrConfigFile(relativePath: string): boolean {
  return workflowAndConfigPaths.has(relativePath) || relativePath.startsWith(".github/workflows/");
}

function summarizeFindings(findings: readonly LintFinding[]): LintSummary {
  return {
    info: findings.filter((finding) => finding.severity === "info").length,
    warning: findings.filter((finding) => finding.severity === "warning").length,
    high: findings.filter((finding) => finding.severity === "high").length
  };
}

function printHumanReadableLintResult(result: LintResult, out: (line: string) => void): void {
  out("MaintainerBench lint report");
  out(`Checked files: ${result.checkedFiles.length}`);
  out(`Findings: ${result.findings.length} high=${result.summary.high} warning=${result.summary.warning} info=${result.summary.info}`);

  if (result.checkedFiles.length > 0) {
    out("Checked:");

    for (const file of result.checkedFiles) {
      out(`  - ${file}`);
    }
  }

  if (result.findings.length === 0) {
    out("No findings.");
    return;
  }

  out("Findings:");

  for (const finding of result.findings) {
    const location = finding.line === undefined ? finding.file : `${finding.file}:${finding.line}`;
    out(`  - [${finding.severity}] ${location} ${finding.id}: ${finding.message}`);
  }
}

function compareFindings(first: LintFinding, second: LintFinding): number {
  const severityDifference = severityRank(second.severity) - severityRank(first.severity);

  if (severityDifference !== 0) {
    return severityDifference;
  }

  const fileDifference = first.file.localeCompare(second.file);

  if (fileDifference !== 0) {
    return fileDifference;
  }

  return (first.line ?? 0) - (second.line ?? 0);
}

function severityRank(severity: LintSeverity): number {
  switch (severity) {
    case "high":
      return 3;
    case "warning":
      return 2;
    case "info":
      return 1;
  }
}

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function isNodeErrorWithCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;
}

function isMissingPathError(error: unknown): boolean {
  return isNodeErrorWithCode(error, "ENOENT") || isNodeErrorWithCode(error, "ENOTDIR");
}
