# Changelog

All notable changes to MaintainerBench will be documented in this file.

## 0.1.0 - 2026-04-26

First public v0.1 release.

### Added

- `maintainerbench init` for creating starter `AGENTS.md`, MaintainerBench config, example task YAML, repo-local skills, and a GitHub Actions workflow.
- `maintainerbench lint` for checking repository-level AI-agent workflow files.
- Lint rules for missing agent guidance, invalid `SKILL.md` frontmatter, dangerous command patterns, secret-looking paths, broad workflow permissions, and unpinned install patterns.
- Task YAML parsing and validation with setup, verify, and risk sections.
- Worktree-based `maintainerbench eval` that runs an external `--agent-command`, runs verification commands, analyzes changed files, and produces a final `pass`, `fail`, or `needs-review` status.
- Markdown and JSON eval reports under `.maintainerbench/runs/<run-id>/`.
- GitHub Action package for CI lint mode.
- TypeScript and Python example targets with MaintainerBench task files.
- Repo-local skill templates for code-change verification, pull request review, and docs synchronization.

### Security And Safety Notes

- MaintainerBench provides guardrails and benchmark reports. It does not guarantee security, correctness, or safe pull request acceptance.
- Eval runs commands in a temporary git worktree, but it is not a complete process sandbox.
- The v0.1 GitHub Action supports lint mode only and rejects eval mode.
- MaintainerBench does not call model APIs, approve pull requests, merge, push, deploy, publish, or auto-accept changes.

### Release Notes

See [v0.1.0 release notes](docs/releases/v0.1.0.md).
