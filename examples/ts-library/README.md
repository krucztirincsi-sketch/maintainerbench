# MaintainerBench TypeScript Library Example

This is a tiny TypeScript package used to demonstrate MaintainerBench tasks against a pnpm workspace package.

Run its test command from the repository root:

```bash
pnpm --filter @maintainerbench/example-ts-library test
```

Example task:

```bash
pnpm exec maintainerbench eval \
  --task examples/ts-library/.maintainerbench/tasks/add-multiply-helper.yml \
  --agent-command "node examples/fake-agents/add-ts-multiply.mjs"
```
