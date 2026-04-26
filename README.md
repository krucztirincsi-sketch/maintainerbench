# MaintainerBench

MaintainerBench is an open-source CLI and GitHub Action toolkit for maintainers who want safer workflows around terminal-based AI coding agents such as Codex, Claude Code, Gemini CLI, OpenCode, and similar tools.

It helps maintainers create repo-local instructions and skills, lint AI-agent workflow files, run benchmark tasks in temporary git worktrees, verify agent changes, analyze diff risk, and write Markdown/JSON reports.

MaintainerBench provides guardrails and reports. It does not guarantee security, correctness, or safe pull request acceptance.

## Quickstart

Package publishing is not configured yet. For local development:

```bash
pnpm install
pnpm build
pnpm exec maintainerbench --help
```

Initialize a repository:

```bash
pnpm exec maintainerbench init
```

Lint agent workflow files:

```bash
pnpm exec maintainerbench lint
pnpm exec maintainerbench lint --json
```

Run a benchmark task with the included fake agent:

```bash
pnpm exec maintainerbench eval \
  --task examples/ts-library/.maintainerbench/tasks/add-multiply-helper.yml \
  --agent-command "node examples/fake-agents/add-ts-multiply.mjs"
```

Run the same task with Codex CLI if Codex is installed:

```bash
pnpm exec maintainerbench eval \
  --task examples/ts-library/.maintainerbench/tasks/add-multiply-helper.yml \
  --agent-command "codex exec \"Add the multiply helper requested by the task. Keep changes small and include a test.\""
```

Codex is optional. MaintainerBench does not hardcode Codex and does not call model APIs directly.

## Core Commands

```bash
maintainerbench init
maintainerbench lint
maintainerbench eval --task <task.yml> --agent-command "<command>"
maintainerbench report
```

`maintainerbench init` creates:

- `AGENTS.md`
- `.maintainerbench/config.yml`
- `.maintainerbench/tasks/example-bugfix.yml`
- `.agents/skills/code-change-verification/SKILL.md`
- `.agents/skills/pr-review/SKILL.md`
- `.agents/skills/docs-sync/SKILL.md`
- `.github/workflows/maintainerbench.yml`

Existing files are skipped unless `--force` is passed. Use `--dry-run` to preview writes.

The generated repo-local skills come from `templates/skills`:

- `code-change-verification`: helps agents verify code changes with focused tests and honest residual-risk reporting.
- `pr-review`: helps agents produce maintainer-friendly pull request reviews focused on correctness, safety, tests, and docs.
- `docs-sync`: helps agents update docs, examples, templates, and report documentation when public behavior changes.

`maintainerbench lint` inspects:

- `AGENTS.md`
- `.agents/**/SKILL.md`
- `.codex/config.toml`
- `.mcp.json`
- `mcp.json`
- `.github/workflows/*.yml`
- `.maintainerbench/config.yml`

It reports missing guidance, invalid skill metadata, dangerous command patterns, likely secret paths, broad workflow permissions, and unpinned install patterns. It exits non-zero when high severity findings exist.

`maintainerbench eval` creates a detached worktree under `.maintainerbench/runs/<run-id>/worktree`, runs setup commands, runs the supplied agent command, runs verify commands, analyzes the diff, and writes:

- `.maintainerbench/runs/<run-id>/report.md`
- `.maintainerbench/runs/<run-id>/report.json`

Final status values:

- `pass`: configured commands passed and no risk findings were produced.
- `fail`: setup, agent, or verification failed.
- `needs-review`: commands passed, but risk findings require maintainer review.

## Examples

- `examples/ts-library`: small TypeScript package with a Vitest test and a MaintainerBench task.
- `examples/python-package`: small dependency-free Python package with a unittest command and a MaintainerBench task.
- `examples/fake-agents/add-ts-multiply.mjs`: fake agent command for testing eval without Codex or another model-backed agent.

Python example test command:

```bash
python -m unittest discover -s examples/python-package/tests
```

## GitHub Action

The v0.1 GitHub Action supports lint mode only:

```yaml
- uses: ./packages/github-action
  with:
    mode: lint
    fail-on: high
```

Until the action is published as a bundled release, use it from a checkout that has installed dependencies and run `pnpm build`.

Action inputs:

- `mode`: `lint` or `eval`; v0.1 supports `lint` only.
- `task`: reserved for future eval support and ignored in lint mode.
- `agent-command`: reserved for future eval support and never run by the v0.1 action.
- `fail-on`: `warning`, `high`, or `never`.

## Sample Report

```md
# MaintainerBench Eval Report

> MaintainerBench provides guardrails and benchmark reports, not guaranteed security or complete sandboxing.

## Summary

| Field | Value |
| --- | --- |
| Status | needs-review |
| Run ID | run-2026-04-26T12-00-00-000Z-ab12cd34 |
| Task | example-bugfix - Example bugfix |
| Agent command | codex exec "fix the bug" |

## Risk Findings

| Severity | Rule | File | Message |
| --- | --- | --- | --- |
| high | eval.forbidden-path | .github/workflows/release.yml | Changed forbidden path matching .github/. |
```

## v0.1 Limitations

- No web app, database, SaaS backend, auth system, or telemetry.
- No model API calls.
- GitHub Action eval mode is not supported yet.
- Eval is not a complete sandbox; commands can still access files permitted by the host operating system.
- MaintainerBench does not approve, merge, push, deploy, publish, or auto-accept pull requests.
- Reports show configured checks and risk findings; they do not prove correctness or security.

## Roadmap

- Publish the CLI and action packaging.
- Expand task examples and fixtures.
- Add a first-class `report` command.
- Improve JSON schemas for CI and GitHub Action consumers.
- Broaden risk rules while keeping false positives explainable.
- Add richer GitHub Action report annotations.

## Documentation

- [Getting Started](docs/getting-started.md)
- [Task Format](docs/task-format.md)
- [Safety Model](docs/safety-model.md)
- [Codex Integration](docs/codex-integration.md)
- [Changelog](CHANGELOG.md)
- [v0.1.0 Release Notes](docs/releases/v0.1.0.md)
