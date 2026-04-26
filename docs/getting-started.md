# Getting Started

MaintainerBench helps maintainers add guardrails around terminal-based AI coding agents. It initializes repo-local instructions and skills, lints agent workflow files, runs benchmark tasks in temporary git worktrees, and writes Markdown/JSON reports.

MaintainerBench reports what it checked. It does not guarantee security, correctness, or safe pull request acceptance.

## Install

Package publishing is not configured yet. For local development from this repository:

```bash
pnpm install
pnpm build
pnpm exec maintainerbench --help
```

In a downstream repository, use the package name once MaintainerBench is published, or run it from a checkout during v0.1 development.

## Initialize A Repository

Run `init` from the root of an existing repository:

```bash
pnpm exec maintainerbench init
```

It creates starter files for AI-agent workflows:

- `AGENTS.md`
- `.maintainerbench/config.yml`
- `.maintainerbench/tasks/example-bugfix.yml`
- `.agents/skills/code-change-verification/SKILL.md`
- `.agents/skills/pr-review/SKILL.md`
- `.agents/skills/docs-sync/SKILL.md`
- `.github/workflows/maintainerbench.yml`

Existing files are skipped by default:

```bash
pnpm exec maintainerbench init --dry-run
pnpm exec maintainerbench init --force
```

After init, edit `AGENTS.md` so it describes your real setup, build, test, and safety expectations.

## Lint Agent Workflow Files

Run lint before asking an agent to work in the repository:

```bash
pnpm exec maintainerbench lint
pnpm exec maintainerbench lint --json
```

Lint checks repository-level AI-agent workflow files such as `AGENTS.md`, repo-local `SKILL.md` files, MCP config, MaintainerBench config, and GitHub workflows. It flags missing guidance, invalid skill frontmatter, dangerous command patterns, likely secret paths, broad workflow permissions, and unpinned install patterns.

The command exits non-zero when high severity findings exist.

## Run Eval With A Fake Agent

`maintainerbench eval` runs a task in a detached temporary git worktree under `.maintainerbench/runs/<run-id>/worktree`. The agent is any shell command supplied through `--agent-command`.

This repository includes a fake agent script that updates the TypeScript example library:

```bash
pnpm exec maintainerbench eval \
  --task examples/ts-library/.maintainerbench/tasks/add-multiply-helper.yml \
  --agent-command "node examples/fake-agents/add-ts-multiply.mjs"
```

Eval runs task setup commands, runs the agent command inside the worktree, runs verification commands, analyzes the diff, and writes:

- `.maintainerbench/runs/<run-id>/report.md`
- `.maintainerbench/runs/<run-id>/report.json`

The final status is:

- `pass`: commands passed and no risk findings were produced.
- `fail`: setup, agent, or verify commands failed.
- `needs-review`: commands passed, but risk rules found something a maintainer should review.

## Run Eval With Codex CLI

Codex is optional. MaintainerBench does not hardcode Codex and does not call model APIs directly. If you have the Codex CLI installed, pass it as the external command:

```bash
pnpm exec maintainerbench eval \
  --task examples/ts-library/.maintainerbench/tasks/add-multiply-helper.yml \
  --agent-command "codex exec \"Add the multiply helper requested by the MaintainerBench task. Keep changes small and include a test.\""
```

Use Codex approval and sandbox settings deliberately. Avoid unsafe bypass modes. MaintainerBench sets the command working directory to the eval worktree, but it is not a complete process sandbox and does not prevent everything the host operating system allows.

## Next Steps

- Read [task-format.md](task-format.md) to write benchmark tasks.
- Read [safety-model.md](safety-model.md) to understand checks and limits.
- Read [codex-integration.md](codex-integration.md) for Codex-specific command examples.
