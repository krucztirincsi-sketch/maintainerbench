---
name: code-change-verification
description: Verify an AI-assisted code change before declaring it complete, using focused tests, repository checks, and clear residual-risk reporting.
---

# Code Change Verification

Use this skill when you have changed code and need to decide whether the work is ready to hand back to a maintainer. It is useful for Codex, Claude Code, Gemini CLI, OpenCode, and other terminal-based coding agents.

## When To Use

- After implementing a bug fix, feature, refactor, dependency update, or test change.
- Before saying a task is done, ready for review, or safe to merge.
- When a command failed and you need to explain what was verified and what remains uncertain.
- When the repository has maintainer-provided commands in `AGENTS.md`, package scripts, CI config, or task YAML.

## Workflow

1. Re-read the request, `AGENTS.md`, and any task-specific instructions.
2. Inspect the diff and list the behavior that changed.
3. Identify the narrowest relevant checks first, such as a package test, single test file, typecheck, or targeted build.
4. Run the focused checks from inside the repository, using existing package scripts when available.
5. Run broader required checks when the change affects shared behavior, public APIs, generated output, CI, or docs.
6. If a check fails, stop and fix the cause when it is in scope. If it is out of scope or environment-related, record the exact failure and why you are not fixing it.
7. Inspect the final diff for accidental edits, generated noise, credential exposure, broad file writes, and changes outside the requested scope.
8. Summarize what passed, what failed or was skipped, and any residual risk. Do not claim the checks prove correctness.

## Safety Boundaries

- Do not read secret or credential files, SSH keys, cloud credentials, or unrelated private files.
- Do not run destructive commands or commands that write outside the repository.
- Do not approve, merge, push, deploy, publish, or auto-accept changes unless the maintainer explicitly asked for that exact action.
- Do not hide failing checks. Report them with the command, exit status, and relevant output.
- Do not say verification guarantees safety, security, or correctness. Say what was checked.

## Examples

Targeted verification after a CLI change:

```text
Changed behavior:
- maintainerbench lint now reports invalid skill frontmatter.

Checks run:
- pnpm --filter @maintainerbench/cli test
- pnpm typecheck

Result:
- Both checks passed.
- I did not run the full repository build because this change only touched test-covered CLI lint logic.
```

Repository-wide verification before handoff:

```text
Checks run:
- pnpm test
- pnpm build
- pnpm exec maintainerbench lint --json

Residual risk:
- These checks cover the local test suite and MaintainerBench self-lint, but they do not guarantee runtime behavior in every downstream repository.
```

Failed verification:

```text
Command failed:
- pnpm --filter @maintainerbench/cli test

Observed failure:
- eval.test.ts failed because the report status was still "risk" instead of "needs-review".

Next step:
- I need to update the status mapping or adjust the test expectation before declaring the change complete.
```
