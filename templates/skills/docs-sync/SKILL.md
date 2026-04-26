---
name: docs-sync
description: Update documentation when public behavior, commands, configuration, templates, workflows, or reports change.
---

# Docs Sync

Use this skill when a code change affects behavior that maintainers, contributors, CI users, or downstream repositories can observe. It helps terminal coding agents keep docs, examples, and generated templates aligned with implementation.

## When To Use

- CLI commands, flags, exit behavior, output formats, reports, or JSON schemas changed.
- Config files, task YAML, workflow files, repo-local skills, or generated templates changed.
- Tests reveal behavior that README or docs do not mention.
- A maintainer asks whether docs need updates before a change is complete.

## Workflow

1. Identify the user-facing surface: command, option, file path, report field, workflow input, template, or generated output.
2. Search existing docs and examples before adding new text. Prefer updating the canonical section over duplicating guidance.
3. Update README for quick-start or high-level behavior, and update focused docs for details.
4. Keep examples executable and consistent with the current CLI, package names, and file paths.
5. State limitations plainly, especially for guardrails, sandboxing, security, unsupported modes, and skipped checks.
6. If generated templates changed, update tests so generated output matches the source templates.
7. Run relevant docs-adjacent checks, such as tests that assert examples, generated files, schemas, or report fields.
8. In the final summary, list docs changed and any behavior that remains intentionally undocumented or experimental.

## Safety Boundaries

- Do not document behavior that is not implemented.
- Do not imply MaintainerBench guarantees security, correctness, or safe pull request acceptance.
- Do not include secret values, private URLs, credential paths, or environment dumps in examples.
- Do not recommend automatic approval, automatic merge, automatic push, or model API calls for v0.1 workflows.
- Do not make docs drift from tests or templates. If the docs claim a file is generated, add or update a test for it when practical.

## Examples

CLI option update:

```text
Behavior changed:
- maintainerbench lint gained --json output.

Docs to check:
- README CLI section
- docs/safety-model.md
- Any tests that assert JSON fields
```

Template update:

```text
Behavior changed:
- maintainerbench init now generates polished repo-local skills.

Docs to check:
- README init section
- templates/skills/*/SKILL.md
- init tests that compare generated skills with templates
```

Clear limitation wording:

```text
MaintainerBench reports risky patterns and verification results. It does not guarantee that a change is secure, correct, or safe to merge.
```
