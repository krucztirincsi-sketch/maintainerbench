# MaintainerBench

MaintainerBench is an open-source CLI and GitHub Action toolkit for maintainers who want safer workflows around terminal-based AI coding agents such as Codex, Claude Code, Gemini CLI, OpenCode, and similar tools.

The project is intended to help maintainers generate repo-local agent instructions, lint agent configuration, define benchmark tasks, run verification commands, analyze diffs for risk, and produce Markdown or JSON reports. MaintainerBench provides guardrails and reporting. It does not guarantee security, correctness, or safe pull request acceptance.

## Status

This repository is an initial v0.1 scaffold. The CLI loads and exposes placeholder commands, but agent execution, linting, worktree orchestration, diff analysis, and report generation are not implemented yet.

## Install

Package publishing is not configured yet. For local development:

```bash
pnpm install
pnpm build
pnpm exec maintainerbench --help
```

## CLI

```bash
maintainerbench --help
maintainerbench init
maintainerbench lint
maintainerbench eval
maintainerbench report
```

The current commands are placeholders that define the intended command surface without performing agent execution or repository mutation.

## v0.1 Roadmap

- Generate starter `AGENTS.md` files and repo-local skills.
- Lint `AGENTS.md`, `SKILL.md`, MCP config, and agent workflow files.
- Detect unsafe shell and file-access patterns conservatively.
- Parse benchmark task YAML with `zod` validation.
- Run benchmark tasks in isolated git worktrees.
- Execute verification commands with argument arrays and bounded timeouts.
- Analyze diffs for risky changes and report residual risk.
- Emit Markdown and JSON reports.
- Provide a GitHub Action wrapper for CI use.

MaintainerBench will not approve, merge, or auto-accept pull requests.
