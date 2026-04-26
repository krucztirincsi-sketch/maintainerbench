# Safety Model

MaintainerBench is a guardrail and reporting tool for repositories that use terminal-based AI coding agents. It helps maintainers define instructions, lint workflow files, run benchmark tasks in temporary git worktrees, and review generated reports.

It does not guarantee security, correctness, or safe pull request acceptance.

## What MaintainerBench Checks

### Repository Guidance

`maintainerbench lint` checks that `AGENTS.md` exists and includes setup, build, test, and safety guidance. This helps agents find the maintainer's actual workflow before editing code.

Rule ids:

- `agents.missing`
- `agents.missing-verification-guidance`
- `agents.missing-safety-guidance`

### Repo-Local Skills

Lint inspects `.agents/**/SKILL.md` and checks for YAML frontmatter with non-empty `name` and `description`.

Rule ids:

- `skill.missing-frontmatter`
- `skill.invalid-frontmatter`
- `skill.missing-name`
- `skill.missing-description`

### Dangerous Command Patterns

Lint flags risky command text in inspected agent workflow files. Examples include recursive force deletion, remote downloads piped directly into a shell, broad permissions, privileged commands, filesystem formatting, and shell fork bombs.

Rule ids:

- `dangerous-command.rm-rf`
- `dangerous-command.curl-pipe-sh`
- `dangerous-command.wget-pipe-sh`
- `dangerous-command.chmod-777`
- `dangerous-command.sudo`
- `dangerous-command.dd-if`
- `dangerous-command.mkfs`
- `dangerous-command.fork-bomb`

### Secret-Looking Paths

Lint flags references that look like secret or credential paths, including `.env`, `secrets/`, `credentials`, `id_rsa`, and `private_key`.

Rule ids:

- `secret-path.dotenv`
- `secret-path.secrets-directory`
- `secret-path.credentials`
- `secret-path.id-rsa`
- `secret-path.private-key`

### Workflow Permissions

Lint flags broad GitHub Actions write permissions in workflow and config files. `permissions: write-all` is high severity. Narrower write scopes are warnings so maintainers can review whether they are necessary.

Rule ids:

- `workflow-permissions.write-all`
- `workflow-permissions.contents-write`
- `workflow-permissions.pull-requests-write`
- `workflow-permissions.actions-write`
- `workflow-permissions.issues-write`
- `workflow-permissions.packages-write`

### Unpinned Install Patterns

Lint flags install commands in automation when they lack lockfile-oriented guidance, such as `npm install` instead of `npm ci` or `pnpm install` without `--frozen-lockfile`.

Rule ids:

- `install.unpinned-npm-install`
- `install.unpinned-pnpm-install`
- `install.unpinned-yarn-install`
- `install.unpinned-bun-install`

### Eval Risk Rules

`maintainerbench eval` applies task-level risk rules after the agent command runs:

- `forbidden_paths`: high severity when changed files match forbidden path patterns.
- `max_files_changed`: high severity when the diff changes too many files.
- `require_tests`: records a finding when files changed but no changed file looks like a test.
- forbidden command patterns in changed content: high severity when changed content contains risky shell patterns.

If commands pass but risk findings exist, final status is `needs-review`.

## Files Inspected By Lint

`maintainerbench lint` inspects:

- `AGENTS.md`
- `.agents/**/SKILL.md`
- `.codex/config.toml`
- `.mcp.json`
- `mcp.json`
- `.github/workflows/*.yml`
- `.maintainerbench/config.yml`

It does not scan every source file in the repository.

## Worktree Isolation

Eval creates a detached temporary git worktree under `.maintainerbench/runs/<run-id>/worktree`. Setup commands, the agent command, verification commands, git diff collection, and report generation are all tied to that worktree.

By default, eval removes the worktree and keeps:

- `.maintainerbench/runs/<run-id>/report.md`
- `.maintainerbench/runs/<run-id>/report.json`

Use `--keep-worktree` only when you need to inspect the generated worktree.

## What MaintainerBench Does Not Guarantee

MaintainerBench is not a complete security sandbox. It does not guarantee that a command cannot access files allowed by the host operating system. It does not prove that code is correct, secure, performant, or maintainable.

MaintainerBench does not:

- call model APIs directly
- approve pull requests
- merge pull requests
- push branches
- deploy or publish packages
- prevent every possible secret access
- replace code review
- replace CI
- replace a real sandbox or container boundary
- guarantee that lint and eval rules catch every risky change

## GitHub Action Boundary

The v0.1 GitHub Action supports `mode: lint` only. It runs `maintainerbench lint --json`, prints a summary, and applies the configured `fail-on` threshold. It rejects `mode: eval` and does not run agent commands or call model APIs.

## Recommended Maintainer Practice

- Keep `AGENTS.md` short, current, and specific to the repository.
- Keep task verification commands deterministic and non-interactive.
- Run eval on small tasks with clear expected outcomes.
- Treat `needs-review` as a prompt for maintainer inspection, not as a failure to ignore.
- Review generated reports alongside the actual diff.
