# TypeScript Library Example Agent Instructions

## Purpose

This example is a tiny TypeScript package used to demonstrate MaintainerBench eval with a fake agent command.

## Development Commands

- Setup: `pnpm install`
- Build: `pnpm build`
- Test: `pnpm --filter @maintainerbench/example-ts-library test`
- Lint: `pnpm exec maintainerbench lint examples/ts-library`

## Safety

- Keep changes inside `examples/ts-library`.
- Do not edit repository workflow files for this demo.
- Do not read or print secrets.
- Keep the change small and include a focused test.
