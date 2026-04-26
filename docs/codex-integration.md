# Codex Integration

MaintainerBench is designed to work with terminal-based coding agents such as Codex by providing repository instructions, skills, benchmark tasks, verification commands, and reports.

## Eval Flow

1. Generate or lint repo-local `AGENTS.md` instructions.
2. Load benchmark task YAML.
3. Prepare an isolated git worktree.
4. Run an agent command supplied by the maintainer.
5. Run verification commands.
6. Analyze the resulting diff for risk.
7. Emit Markdown and JSON reports.

The first usable eval command supports any terminal-based agent or fake agent command supplied through `--agent-command`:

```bash
maintainerbench eval --task .maintainerbench/tasks/example-bugfix.yml --agent-command "<command>"
```

MaintainerBench does not hardcode Codex and does not call model APIs directly. The command is run inside a temporary detached git worktree under `.maintainerbench/runs/<run-id>/worktree`. Eval then runs verification commands, records stdout, stderr, exit codes, elapsed time, changed files, and a git diff summary, and reports `pass`, `fail`, or `risk`.

The risk summary currently checks forbidden paths, forbidden command patterns in changed content, too many changed files, and missing test changes when `require_tests` is enabled. MaintainerBench does not commit, merge, push, approve pull requests, or provide a complete security sandbox.
