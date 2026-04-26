# Getting Started

MaintainerBench is currently an initial v0.1 scaffold. It provides repository initialization, agent-workflow linting, task YAML validation, worktree-based eval runs, diff risk checks, and Markdown/JSON eval reports.

## Local Development

```bash
pnpm install
pnpm test
pnpm build
```

## CLI

```bash
maintainerbench --help
maintainerbench init
maintainerbench lint
maintainerbench eval
maintainerbench report
```

Run `maintainerbench init` from the root of an existing repository to add starter AI coding-agent workflow files:

```bash
maintainerbench init
```

The command writes `AGENTS.md`, `.maintainerbench/config.yml`, an example benchmark task, three repo-local skills, and a MaintainerBench GitHub Actions workflow. Existing files are skipped unless you pass `--force`.

```bash
maintainerbench init --dry-run
maintainerbench init --force
```

The generated config and workflow include placeholders for future GitHub Action behavior. The `lint` command scans repository-level AI-agent workflow files, and `eval` runs maintainer-supplied agent commands in temporary git worktrees. MaintainerBench does not modify pull requests, approve changes, merge, push, or guarantee security.
