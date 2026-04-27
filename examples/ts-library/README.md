# MaintainerBench TypeScript Library Example

This demo shows MaintainerBench eval on a tiny TypeScript package. It does not require Codex or any model-backed agent.

The package starts with one simple helper:

- `src/index.ts` exports `add(left, right)`.
- `test/index.test.ts` verifies `add`.
- `.maintainerbench/tasks/add-multiply-helper.yml` asks an agent to add `multiply(left, right)` and a focused test.
- `examples/fake-agents/add-ts-multiply.mjs` is a fake agent that makes that harmless change.

Run all commands from the repository root.

## Test The Package

Run the example package test command:

```bash
pnpm --filter @maintainerbench/example-ts-library test
```

Expected result: Vitest should pass the existing `add` test.

## Lint The Demo

Lint the example's agent workflow files:

```bash
pnpm exec maintainerbench lint examples/ts-library
```

Expected result: MaintainerBench checks `examples/ts-library/AGENTS.md` and `.maintainerbench/config.yml` and reports no high severity findings.

## Run Eval With The Fake Agent

Run the task with the fake agent command:

```bash
pnpm exec maintainerbench eval \
  --task examples/ts-library/.maintainerbench/tasks/add-multiply-helper.yml \
  --agent-command "node examples/fake-agents/add-ts-multiply.mjs"
```

Expected result:

- MaintainerBench creates a temporary git worktree under `.maintainerbench/runs/<run-id>/worktree`.
- The fake agent adds `multiply` to `examples/ts-library/src/index.ts`.
- The fake agent adds a focused test in `examples/ts-library/test/index.test.ts`.
- Eval runs `pnpm --filter @maintainerbench/example-ts-library test`.
- The final status should be `pass`.
- Reports are written to `.maintainerbench/runs/<run-id>/report.md` and `.maintainerbench/runs/<run-id>/report.json`.

MaintainerBench reports what it checked. It does not guarantee correctness or security.
