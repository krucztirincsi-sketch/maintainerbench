---
name: pr-review
description: Review an AI-assisted pull request for correctness, safety, maintainability, tests, and documentation, then produce a maintainer-friendly review.
---

# Pull Request Review

Use this skill when reviewing a pull request or local diff, especially when an AI coding agent produced or modified the change. It is useful for terminal coding agents that can inspect files, diffs, test output, and repository instructions.

## When To Use

- A maintainer asks for a PR review, patch review, or risk review.
- The change touches agent instructions, workflows, task YAML, tests, public APIs, or security-sensitive behavior.
- You need to decide what feedback is actionable before approval or merge.
- CI results, generated reports, or benchmark output need maintainer-focused interpretation.

## Workflow

1. Read `AGENTS.md`, the PR description, linked issue or task, and any maintainer review guidance.
2. Inspect the changed files and understand the intended behavior before judging style.
3. Check correctness first: logic, edge cases, error handling, data validation, path handling, and user-visible behavior.
4. Check safety: secret access, broad permissions, risky shell execution, writes outside the repository, unbounded deletion, auto-merge, auto-approve, auto-push, telemetry, and model API calls.
5. Check tests: confirm new or changed behavior is covered, and look for missing negative cases or brittle assertions.
6. Check docs: confirm README, docs, examples, generated templates, and CLI help match the implementation.
7. Run or inspect relevant verification results when available. If you cannot run checks, state that clearly.
8. Write findings first, ordered by severity. Keep each finding concrete, actionable, and tied to a file and line when possible.
9. Add a short summary only after findings. Include residual risk or test gaps without claiming the review proves correctness.

## Safety Boundaries

- Do not approve, merge, push, deploy, publish, or auto-accept a pull request unless the maintainer explicitly asks for that exact operation.
- Do not dismiss failed tests or risky behavior because the patch is small.
- Do not expose secret values, credential files, or private environment data in review comments.
- Do not request broad rewrites when a narrow correctness or safety fix is enough.
- Do not claim the review guarantees security or correctness.

## Examples

High-impact finding:

```text
[high] packages/cli/src/commands/eval.ts:72
The task path is resolved before checking whether the real path stays inside the repository. A symlinked task file can point outside the repo and still be read. Resolve the real path first, then reject it when it escapes the repo root.
```

Warning-level finding:

```text
[warning] README.md:88
The README says eval reports "risk", but the CLI now emits "needs-review". Update the docs so users and CI consumers see the same status vocabulary.
```

No findings:

```text
I did not find blocking issues in this diff. The focused CLI tests pass, but I did not run the full integration matrix, so runtime coverage outside the local test suite remains a residual risk.
```
