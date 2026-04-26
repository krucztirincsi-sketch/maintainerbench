# Codex Integration

MaintainerBench can run Codex CLI as an external command through `--agent-command`. MaintainerBench does not hardcode Codex, does not call model APIs directly, and also works with fake agents or other terminal coding agents.

## Basic Flow

1. Add or update `AGENTS.md` so Codex has repository-specific instructions.
2. Write a MaintainerBench task YAML file.
3. Run `maintainerbench eval` with a Codex CLI command.
4. Review the generated diff and reports.

```bash
pnpm exec maintainerbench eval \
  --task examples/ts-library/.maintainerbench/tasks/add-multiply-helper.yml \
  --agent-command "codex exec \"Add the multiply helper requested by the task. Keep changes small and include a test.\""
```

The command runs inside `.maintainerbench/runs/<run-id>/worktree`, not in your main checkout. Eval then runs verification commands, records command output, collects changed files and a diff summary, applies risk rules, and writes `report.md` and `report.json`.

## Approval And Sandbox Caution

Use Codex approval and sandbox settings deliberately. MaintainerBench is a guardrail and benchmark runner, not a complete security sandbox.

Recommended approach:

- Prefer Codex settings that ask before risky commands.
- Keep task scope small and verification commands explicit.
- Avoid bypass modes that disable meaningful approval or filesystem protections.
- Do not give the agent credentials, production tokens, SSH keys, or broad cloud access.
- Review the MaintainerBench report and the actual diff before merging.

MaintainerBench never approves, merges, pushes, deploys, or calls model APIs by itself.

## Fake Agent First

Before using Codex, you can test the task and report flow with the included fake agent:

```bash
pnpm exec maintainerbench eval \
  --task examples/ts-library/.maintainerbench/tasks/add-multiply-helper.yml \
  --agent-command "node examples/fake-agents/add-ts-multiply.mjs"
```

This helps confirm that the task file, worktree creation, verification command, risk rules, and reports behave as expected.

## Report Review

After eval, open the report paths printed by the CLI:

- `.maintainerbench/runs/<run-id>/report.md`
- `.maintainerbench/runs/<run-id>/report.json`

The report includes:

- run id
- task id and title
- agent command
- setup, agent, and verify command results
- changed files
- diff summary
- risk findings
- final status
- elapsed time

Use `pass` as evidence that configured commands passed, not as proof of correctness. Use `needs-review` as a signal to inspect risk findings before deciding what to do next.
