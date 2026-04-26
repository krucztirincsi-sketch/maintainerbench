# Codex Integration

MaintainerBench is designed to work with terminal-based coding agents such as Codex by providing repository instructions, skills, benchmark tasks, verification commands, and reports.

## Planned Flow

1. Generate or lint repo-local `AGENTS.md` instructions.
2. Load benchmark task YAML.
3. Prepare an isolated git worktree.
4. Run an agent command supplied by the maintainer.
5. Run verification commands.
6. Analyze the resulting diff for risk.
7. Emit Markdown and JSON reports.

This flow is not implemented in the initial scaffold. No model API calls are made.
