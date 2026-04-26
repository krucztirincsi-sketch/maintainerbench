# Getting Started

MaintainerBench is currently an initial scaffold. It provides the package layout, CLI entrypoint, repository initialization command, placeholder guardrail commands, templates, and documentation pages that future v0.1 work will build on.

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

The generated config and workflow include placeholders for future lint and eval behavior. The `lint`, `eval`, and `report` commands do not execute agents, modify pull requests, or perform repository risk analysis yet.
