import { lstat, mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";

type InitFileStatus =
  | "created"
  | "overwritten"
  | "skipped"
  | "would-create"
  | "would-overwrite"
  | "would-skip";

interface InlineInitFileTemplate {
  readonly path: string;
  readonly content: string;
}

interface FileInitFileTemplate {
  readonly path: string;
  readonly templatePath: string;
}

type InitFileTemplate = InlineInitFileTemplate | FileInitFileTemplate;

export interface InitFileResult {
  readonly path: string;
  readonly status: InitFileStatus;
  readonly reason?: string;
}

export interface InitResult {
  readonly cwd: string;
  readonly dryRun: boolean;
  readonly files: readonly InitFileResult[];
}

export interface RunInitOptions {
  readonly cwd?: string;
  readonly force?: boolean;
  readonly dryRun?: boolean;
  readonly out?: (line: string) => void;
}

const starterFiles: readonly InitFileTemplate[] = [
  {
    path: "AGENTS.md",
    content: `# Repository Agent Instructions

## Purpose

Describe what this repository does, who maintains it, and what changes are safe for AI coding agents to attempt.

## Boundaries

- Keep file writes inside this repository.
- Do not read secrets, credentials, SSH keys, cloud credentials, or files from home directories.
- Do not approve, merge, or auto-accept pull requests.
- Prefer small, reviewable changes with tests.
- Explain skipped checks and residual risk in reports.

## Verification

Before declaring work complete, run the commands listed by the maintainer for this repository. Add project-specific commands here.

\`\`\`bash
pnpm test
\`\`\`
`
  },
  {
    path: ".maintainerbench/config.yml",
    content: `version: 1

instructions: AGENTS.md

tasks:
  - .maintainerbench/tasks/example-bugfix.yml

skills:
  - .agents/skills/code-change-verification/SKILL.md
  - .agents/skills/pr-review/SKILL.md
  - .agents/skills/docs-sync/SKILL.md

verify:
  commands:
    - pnpm test

lint:
  enabled: false
  note: Placeholder for future MaintainerBench lint checks.

eval:
  enabled: false
  note: Placeholder for future MaintainerBench benchmark execution.
`
  },
  {
    path: ".maintainerbench/tasks/example-bugfix.yml",
    content: `id: example-bugfix
title: Example bugfix task
description: |-
  Replace this example with a small, reviewable bugfix task for an AI coding agent.
setup:
  commands: []
verify:
  commands:
    - run: pnpm test
      timeoutSeconds: 120
risk:
  max_files_changed: 20
  require_tests: true
`
  },
  {
    path: ".agents/skills/code-change-verification/SKILL.md",
    templatePath: "skills/code-change-verification/SKILL.md"
  },
  {
    path: ".agents/skills/pr-review/SKILL.md",
    templatePath: "skills/pr-review/SKILL.md"
  },
  {
    path: ".agents/skills/docs-sync/SKILL.md",
    templatePath: "skills/docs-sync/SKILL.md"
  },
  {
    path: ".github/workflows/maintainerbench.yml",
    content: `name: MaintainerBench

on:
  pull_request:
  workflow_dispatch:

jobs:
  maintainerbench:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.31.0

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run MaintainerBench lint
        run: pnpm exec maintainerbench lint
`
  }
];

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize the current repository for AI coding-agent workflows.")
    .option("--force", "Overwrite existing starter files.")
    .option("--dry-run", "Print the files that would be created without writing them.")
    .action(async (options: { force?: boolean; dryRun?: boolean }) => {
      await runInitCommand({
        force: options.force === true,
        dryRun: options.dryRun === true
      });
    });
}

export async function runInitCommand(options: RunInitOptions = {}): Promise<InitResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const root = await realpath(cwd);
  const dryRun = options.dryRun === true;
  const force = options.force === true;
  const files: InitFileResult[] = [];

  for (const starterFileDefinition of starterFiles) {
    const starterFile = await resolveStarterFile(starterFileDefinition);
    files.push(await applyStarterFile(root, starterFile, { dryRun, force }));
  }

  const result: InitResult = { cwd: root, dryRun, files };
  printInitSummary(result, options.out ?? ((line: string) => console.log(line)));

  return result;
}

async function resolveStarterFile(starterFile: InitFileTemplate): Promise<InlineInitFileTemplate> {
  if ("content" in starterFile) {
    return starterFile;
  }

  return {
    path: starterFile.path,
    content: await readTemplateFile(starterFile.templatePath)
  };
}

async function readTemplateFile(templatePath: string): Promise<string> {
  const relativePath = normalizeSafeTemplatePath(templatePath);

  for (const templatesRoot of getTemplateRoots()) {
    const absolutePath = path.resolve(templatesRoot, relativePath);

    if (!isInsideRoot(templatesRoot, absolutePath)) {
      throw new Error(`Refusing to read a template outside the templates directory: ${templatePath}`);
    }

    try {
      return await readFile(absolutePath, "utf8");
    } catch (error: unknown) {
      if (isNodeErrorWithCode(error, "ENOENT")) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Template file not found: ${templatePath}`);
}

function getTemplateRoots(): readonly string[] {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

  return [
    path.resolve(moduleDirectory, "../templates"),
    path.resolve(moduleDirectory, "../../../../templates")
  ];
}

function normalizeSafeTemplatePath(templatePath: string): string {
  if (templatePath.includes("\0")) {
    throw new Error("Refusing to use a template path containing a null byte.");
  }

  const portablePath = templatePath.replace(/\\/g, "/");

  if (
    portablePath.length === 0 ||
    portablePath === "." ||
    path.posix.isAbsolute(portablePath) ||
    path.win32.isAbsolute(templatePath)
  ) {
    throw new Error(`Refusing to use unsafe template path: ${templatePath}`);
  }

  const normalized = path.posix.normalize(portablePath);

  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`Refusing to use path traversal template path: ${templatePath}`);
  }

  return normalized;
}

async function applyStarterFile(
  root: string,
  starterFile: InlineInitFileTemplate,
  options: { readonly dryRun: boolean; readonly force: boolean }
): Promise<InitFileResult> {
  const relativePath = normalizeSafeRelativePath(starterFile.path);
  const absolutePath = resolveInsideRoot(root, relativePath);
  const existing = await getExistingPathInfo(root, absolutePath);

  if (existing?.unsafeReason !== undefined) {
    return {
      path: relativePath,
      status: options.dryRun ? "would-skip" : "skipped",
      reason: existing.unsafeReason
    };
  }

  if (existing !== undefined && !existing.isWritableFile) {
    return {
      path: relativePath,
      status: options.dryRun ? "would-skip" : "skipped",
      reason: "path already exists and is not a file"
    };
  }

  if (existing !== undefined && !options.force) {
    return {
      path: relativePath,
      status: options.dryRun ? "would-skip" : "skipped",
      reason: "already exists; use --force to overwrite"
    };
  }

  if (options.dryRun) {
    return {
      path: relativePath,
      status: existing === undefined ? "would-create" : "would-overwrite"
    };
  }

  await ensureParentDirectoryInsideRoot(root, path.dirname(absolutePath));
  await writeFile(absolutePath, starterFile.content, "utf8");

  return {
    path: relativePath,
    status: existing === undefined ? "created" : "overwritten"
  };
}

function normalizeSafeRelativePath(relativePath: string): string {
  if (relativePath.includes("\0")) {
    throw new Error("Refusing to use a path containing a null byte.");
  }

  const portablePath = relativePath.replace(/\\/g, "/");

  if (
    portablePath.length === 0 ||
    portablePath === "." ||
    path.posix.isAbsolute(portablePath) ||
    path.win32.isAbsolute(relativePath)
  ) {
    throw new Error(`Refusing to use unsafe output path: ${relativePath}`);
  }

  const normalized = path.posix.normalize(portablePath);

  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`Refusing to use path traversal output path: ${relativePath}`);
  }

  return normalized;
}

function resolveInsideRoot(root: string, relativePath: string): string {
  const absolutePath = path.resolve(root, relativePath);

  if (!isInsideRoot(root, absolutePath)) {
    throw new Error(`Refusing to write outside the current working directory: ${relativePath}`);
  }

  return absolutePath;
}

async function getExistingPathInfo(
  root: string,
  absolutePath: string
): Promise<{ readonly isWritableFile: boolean; readonly unsafeReason?: string } | undefined> {
  let pathStat: Awaited<ReturnType<typeof lstat>>;

  try {
    pathStat = await lstat(absolutePath);
  } catch (error: unknown) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return undefined;
    }

    throw error;
  }

  if (pathStat.isSymbolicLink()) {
    let target: string;

    try {
      target = await realpath(absolutePath);
    } catch (error: unknown) {
      if (isNodeErrorWithCode(error, "ENOENT")) {
        return {
          isWritableFile: false,
          unsafeReason: "path is a broken symlink"
        };
      }

      throw error;
    }

    if (!isInsideRoot(root, target)) {
      return {
        isWritableFile: false,
        unsafeReason: "path is a symlink outside the current working directory"
      };
    }

    const targetStat = await stat(absolutePath);
    return { isWritableFile: targetStat.isFile() };
  }

  return { isWritableFile: pathStat.isFile() };
}

async function ensureParentDirectoryInsideRoot(root: string, directoryPath: string): Promise<void> {
  if (!isInsideRoot(root, directoryPath)) {
    throw new Error(`Refusing to create a directory outside the current working directory: ${directoryPath}`);
  }

  const relativePath = path.relative(root, directoryPath);

  if (relativePath.length === 0) {
    return;
  }

  const segments = relativePath.split(path.sep).filter((segment) => segment.length > 0);
  let currentPath = root;

  for (const segment of segments) {
    currentPath = path.join(currentPath, segment);
    let currentStat: Awaited<ReturnType<typeof lstat>>;

    try {
      currentStat = await lstat(currentPath);
    } catch (error: unknown) {
      if (isNodeErrorWithCode(error, "ENOENT")) {
        await mkdir(currentPath);
        continue;
      }

      throw error;
    }

    if (currentStat.isSymbolicLink()) {
      let target: string;

      try {
        target = await realpath(currentPath);
      } catch (error: unknown) {
        if (isNodeErrorWithCode(error, "ENOENT")) {
          throw new Error(`Refusing to write through a broken symlink: ${currentPath}`);
        }

        throw error;
      }

      if (!isInsideRoot(root, target)) {
        throw new Error(`Refusing to write through a symlink outside the current working directory: ${currentPath}`);
      }

      const targetStat = await stat(currentPath);

      if (!targetStat.isDirectory()) {
        throw new Error(`Refusing to use a non-directory path as a parent directory: ${currentPath}`);
      }

      continue;
    }

    if (!currentStat.isDirectory()) {
      throw new Error(`Refusing to use a non-directory path as a parent directory: ${currentPath}`);
    }
  }
}

function isInsideRoot(root: string, candidatePath: string): boolean {
  const relativePath = path.relative(root, candidatePath);
  return relativePath.length === 0 || (relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath));
}

function printInitSummary(result: InitResult, out: (line: string) => void): void {
  out(result.dryRun ? "MaintainerBench init summary (dry run)" : "MaintainerBench init summary");
  printGroup(result.files, result.dryRun ? "Would create files" : "Created files", result.dryRun ? "would-create" : "created", out);
  printGroup(
    result.files,
    result.dryRun ? "Would overwrite files" : "Overwritten files",
    result.dryRun ? "would-overwrite" : "overwritten",
    out
  );
  printGroup(result.files, result.dryRun ? "Would skip files" : "Skipped files", result.dryRun ? "would-skip" : "skipped", out);

  if (result.dryRun) {
    out("No files were written.");
  }
}

function printGroup(
  files: readonly InitFileResult[],
  label: string,
  status: InitFileStatus,
  out: (line: string) => void
): void {
  const matchingFiles = files.filter((file) => file.status === status);

  out(`${label}:`);

  if (matchingFiles.length === 0) {
    out("  (none)");
    return;
  }

  for (const file of matchingFiles) {
    out(`  - ${file.path}${file.reason === undefined ? "" : ` (${file.reason})`}`);
  }
}

function isNodeErrorWithCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;
}
