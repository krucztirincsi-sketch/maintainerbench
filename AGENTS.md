# MaintainerBench Agent Instructions

## Project Purpose

MaintainerBench is an open-source CLI and GitHub Action toolkit for open-source maintainers who want to safely adopt AI coding agents such as Codex, Claude Code, Gemini CLI, OpenCode, and other terminal-based coding agents.

The project helps maintainers:

- Generate `AGENTS.md` files and repo-local skills.
- Lint `AGENTS.md`, `SKILL.md`, MCP config, and agent workflow files.
- Detect unsafe patterns such as secret access, dangerous shell commands, `curl | sh`, `rm -rf`, `chmod 777`, path traversal, and unpinned install commands.
- Define benchmark tasks in YAML.
- Run AI-agent tasks in isolated git worktrees.
- Verify commands after an agent modifies code.
- Analyze diffs for risk.
- Output Markdown and JSON reports.
- Provide a GitHub Action for CI use.

MaintainerBench provides guardrails and benchmark reports. It must be honest about its limits and must never claim to guarantee security.

## Technical Direction

- This repository is a TypeScript monorepo.
- Use Node.js 20+.
- Use `pnpm` for package management and scripts.
- Use TypeScript strict mode.
- Use `commander` for CLI commands.
- Use `zod` for config, benchmark task, and input validation.
- Use `vitest` for tests.
- Do not add production dependencies without a clear reason.

## Development Commands

- Setup: `pnpm install`
- Build: `pnpm build`
- Test: `pnpm test`
- CLI package tests: `pnpm --filter @maintainerbench/cli test`
- CLI package build: `pnpm --filter @maintainerbench/cli build`
- Lint: there is no `pnpm lint` script yet; repository agent-workflow linting is handled through `pnpm exec maintainerbench lint` for now.

## v0.1 Scope Boundaries

For v0.1, never introduce:

- A web app.
- A database.
- A SaaS backend.
- An auth system.
- Telemetry.
- Model API calls.
- Auto-merge.
- Automatic PR approval.

MaintainerBench may inspect files, lint configuration, run benchmark tasks, execute verification commands, and report risk. It must not approve, merge, or otherwise automatically accept pull requests.

## Safety Rules

- All file writes must stay inside the repository.
- Prevent path traversal when reading or writing paths supplied by config, task files, CLI flags, or workflow inputs.
- Avoid shelling out unless necessary. Prefer Node.js APIs and well-scoped library calls.
- When shell execution is necessary, validate inputs, avoid shell interpolation, and prefer argument arrays over shell strings.
- Treat access to secrets, credentials, environment dumps, home directories, SSH keys, and cloud credentials as high risk.
- Flag dangerous shell patterns conservatively, including but not limited to `curl | sh`, `wget | sh`, `rm -rf`, `chmod 777`, unpinned install commands, and writes outside the repository.

## Development Requirements

- All commands must have tests.
- Every feature change must include tests and README or docs updates.
- Keep changes focused on the CLI, GitHub Action, linting, benchmark, worktree, verification, diff analysis, and report-generation surfaces.
- Agents must run relevant tests before declaring work complete.
- Run `pnpm test` before declaring repository-wide work complete.
- Do not weaken strict TypeScript settings to make implementation easier.
- Keep reports clear about what was checked, what was skipped, and what risk remains.
