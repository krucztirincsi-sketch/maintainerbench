# MaintainerBench

MaintainerBench is an open-source CLI and GitHub Action toolkit for maintainers who want safer workflows around terminal-based AI coding agents such as Codex, Claude Code, Gemini CLI, OpenCode, and similar tools.

The project is intended to help maintainers generate repo-local agent instructions, lint agent configuration, define benchmark tasks, run verification commands, analyze diffs for risk, and produce Markdown or JSON reports. MaintainerBench provides guardrails and reporting. It does not guarantee security, correctness, or safe pull request acceptance.

## Status

This repository is an initial v0.1 scaffold. The `init` command can create starter repository files for AI coding-agent workflows, and `lint` can scan repository-level agent workflow files for missing guidance and unsafe patterns. Agent execution, worktree orchestration, diff analysis, and report generation are not implemented yet.

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

`maintainerbench init` initializes the current working directory by creating:

- `AGENTS.md`
- `.maintainerbench/config.yml`
- `.maintainerbench/tasks/example-bugfix.yml`
- `.agents/skills/code-change-verification/SKILL.md`
- `.agents/skills/pr-review/SKILL.md`
- `.agents/skills/docs-sync/SKILL.md`
- `.github/workflows/maintainerbench.yml`

Existing files are skipped by default. Use `--force` to overwrite starter files, or `--dry-run` to print the planned changes without writing files.

`maintainerbench lint` scans:

- `AGENTS.md`
- `.agents/**/SKILL.md`
- `.codex/config.toml`
- `.mcp.json` and `mcp.json`
- `.github/workflows/*.yml`
- `.maintainerbench/config.yml`

It reports these v0.1 rule categories:

- Repository guidance: missing `AGENTS.md`, missing setup/build/test guidance, and missing safety guidance.
- Skill metadata: missing or invalid `SKILL.md` YAML frontmatter, including missing `name` or `description`.
- Dangerous commands: `rm -rf`, `curl ... | sh`, `wget ... | sh`, `chmod 777`, `sudo`, `dd if=`, `mkfs`, and shell fork bombs.
- Secret-looking paths: `.env`, `secrets/`, `credentials`, `id_rsa`, and `private_key`.
- Workflow permissions: `permissions: write-all` as high severity, plus narrower write scopes such as `contents: write`, `pull-requests: write`, `actions: write`, `issues: write`, and `packages: write` as warnings.
- Unpinned install patterns in workflow/config files: `npm install`, `pnpm install`, `yarn install`, and `bun install` without lockfile or frozen-lockfile guidance.

Human-readable output is the default, and JSON is available with `--json`.

```bash
maintainerbench lint
maintainerbench lint --json
```

The lint command exits non-zero when high severity findings are present. The `eval` and `report` commands are still placeholders that define the intended command surface without performing agent execution or repository risk analysis.

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
