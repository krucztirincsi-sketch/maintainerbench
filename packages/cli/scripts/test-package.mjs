import { closeSync, openSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDirectory, "..");
const distIndex = path.join(packageRoot, "dist", "index.js");

const source = await readFile(distIndex, "utf8");
assert(source.startsWith("#!/usr/bin/env node\n"), "dist/index.js is missing the Node shebang");

const help = await run(process.execPath, [distIndex, "--help"], packageRoot);
assert(help.stdout.includes("Usage: maintainerbench"), "built CLI help did not render the expected command name");

const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "maintainerbench-cli-package-"));

try {
  const init = await run(process.execPath, [distIndex, "init", "--dry-run"], temporaryDirectory);
  assert(init.stdout.includes("MaintainerBench init summary"), "built CLI init dry run did not print a summary");
  assert(
    init.stdout.includes(".agents/skills/code-change-verification/SKILL.md"),
    "built CLI init dry run did not load packaged skill templates"
  );

  const packDirectory = path.join(temporaryDirectory, "pack");
  await mkdir(packDirectory);
  const pack = await run("pnpm", ["pack", "--pack-destination", packDirectory], packageRoot);
  const tarballName = pack.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.endsWith(".tgz"));

  assert(tarballName !== undefined, "pnpm pack did not print a tarball name");

  const tarballPath = path.resolve(packDirectory, path.basename(tarballName));
  const tarball = await run("tar", ["-tf", tarballPath], packageRoot);

  for (const expectedPath of [
    "package/package.json",
    "package/dist/index.js",
    "package/dist/templates/skills/code-change-verification/SKILL.md",
    "package/dist/templates/skills/pr-review/SKILL.md",
    "package/dist/templates/skills/docs-sync/SKILL.md"
  ]) {
    assert(tarball.stdout.includes(expectedPath), `package tarball is missing ${expectedPath}`);
  }

  console.log(`Packed package smoke test passed: ${tarballPath}`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run(command, args, cwd) {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "maintainerbench-command-"));
  const stdoutPath = path.join(outputDirectory, "stdout.txt");
  const stderrPath = path.join(outputDirectory, "stderr.txt");
  const stdoutFd = openSync(stdoutPath, "w+");
  const stderrFd = openSync(stderrPath, "w+");

  try {
    const code = await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        env: process.env,
        stdio: ["ignore", stdoutFd, stderrFd]
      });

      child.on("error", reject);
      child.on("close", resolve);
    });
    closeSync(stdoutFd);
    closeSync(stderrFd);

    const stdout = await readFile(stdoutPath, "utf8");
    const stderr = await readFile(stderrPath, "utf8");

    if (code === 0) {
      return { stdout, stderr };
    }

    throw new Error(`${command} ${args.join(" ")} failed with exit code ${code}\n${stdout}\n${stderr}`);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
}
