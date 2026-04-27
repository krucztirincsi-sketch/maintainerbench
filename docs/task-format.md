# Task Format

MaintainerBench eval tasks are YAML files validated with `zod`. A task describes what an agent should attempt, which setup and verification commands to run, and which diff risk rules should affect the final report.

The CLI still requires `--agent-command`; task files do not cause MaintainerBench to call a model API.

## Complete Example

```yaml
id: ts-library-add-multiply-helper
title: Add a multiply helper to the TypeScript example library
description: |-
  Add an exported multiply(left, right) helper to examples/ts-library and cover it
  with a focused unit test.
setup:
  commands: []
verify:
  commands:
    - run: pnpm --filter @maintainerbench/example-ts-library test
      timeoutSeconds: 120
risk:
  forbidden_paths:
    - .github/
    - AGENTS.md
  max_files_changed: 4
  require_tests: true
```

Run it with:

```bash
pnpm exec maintainerbench eval \
  --task examples/ts-library/.maintainerbench/tasks/add-multiply-helper.yml \
  --agent-command "node examples/fake-agents/add-ts-multiply.mjs"
```

## Fields

### `id`

Required string. A stable task identifier used in reports. Prefer lowercase letters, digits, and hyphens.

Valid:

```yaml
id: fix-readme-typo
```

Invalid:

```yaml
id: ""
```

### `title`

Required string. A short maintainer-readable title.

Valid:

```yaml
title: Fix README typo
```

Invalid:

```yaml
title: ""
```

### `description`

Optional string. Use it to give the agent enough context to understand the intended change. Multi-line YAML blocks are supported.

Valid:

```yaml
description: |-
  Update the README quickstart so the lint command uses --json in the CI example.
```

### `setup`

Optional command section. Setup commands run inside the temporary worktree before the agent command. Use setup for dependency installation or generated fixtures that the task requires.

Valid object form:

```yaml
setup:
  commands:
    - run: pnpm install --frozen-lockfile
      timeoutSeconds: 120
```

Valid shorthand form:

```yaml
setup:
  - pnpm install --frozen-lockfile
```

Invalid:

```yaml
setup:
  commands:
    - run: ""
```

### `verify`

Optional command section. Verification commands run after the agent command. If a verification command fails, eval status is `fail`.

Valid:

```yaml
verify:
  commands:
    - run: pnpm test
      timeoutSeconds: 180
    - run: pnpm exec maintainerbench lint --json
```

Valid shorthand:

```yaml
verify:
  - pnpm test
```

Invalid:

```yaml
verify:
  commands:
    - timeoutSeconds: 60
```

### Command `run`

Required for object-form commands. It is a shell string executed in the worktree. Keep commands explicit and repository-local.

Valid:

```yaml
- run: pnpm --filter @maintainerbench/cli test
```

Avoid commands that read secrets, write outside the repository, install unpinned tools, or depend on interactive prompts.

### Command `timeoutSeconds`

Optional positive integer. MaintainerBench sends a termination signal when the command exceeds this duration.

Valid:

```yaml
- run: pnpm test
  timeoutSeconds: 120
```

Invalid:

```yaml
- run: pnpm test
  timeoutSeconds: 0
```

### `agent.command`

Optional metadata object. It may document a suggested command for humans, but v0.1 eval still requires the explicit CLI flag `--agent-command`.

Valid:

```yaml
agent:
  command: codex exec "Fix the task described in this YAML file."
```

### `risk`

Optional object. Risk rules affect the final report. If commands pass but risk findings exist, status is `needs-review`.

### `risk.forbidden_paths`

Optional array of path patterns. If a changed file matches a forbidden path, eval records a high severity finding.

Patterns ending in `/` match files under that directory. Plain paths match the exact path or files below it. `*` wildcards are supported.

Valid:

```yaml
risk:
  forbidden_paths:
    - .github/
    - AGENTS.md
    - packages/*/secrets/
```

### `risk.max_files_changed`

Optional positive integer. Eval records a high severity finding when the number of changed files exceeds this value.

Valid:

```yaml
risk:
  max_files_changed: 10
```

Invalid:

```yaml
risk:
  max_files_changed: 0
```

### `risk.require_tests`

Optional boolean, default `false`. When true, eval records a finding if files changed but no changed file looks like a test file.

Valid:

```yaml
risk:
  require_tests: true
```

## Minimal Valid Task

```yaml
id: docs-only
title: Update docs
verify:
  - pnpm test
```

## Invalid Task Examples

Missing required title:

```yaml
id: missing-title
verify:
  - pnpm test
```

Wrong field type:

```yaml
id: wrong-type
title: Wrong type
risk:
  require_tests: yes please
```

Empty command:

```yaml
id: empty-command
title: Empty command
verify:
  commands:
    - run: ""
```

## Report Output

Eval writes `report.md` and `report.json` under `.maintainerbench/runs/<run-id>/`. Reports include the task id and title, agent command, setup/agent/verify command results, changed files, diff summary, risk findings, final status, elapsed time, and a note that MaintainerBench provides guardrails rather than guaranteed security.

The JSON report uses `schemaVersion: 1` and keeps setup, agent, and verify command results in separate fields under `commands`. It also includes summary counts for commands, failed commands, changed files, total risk findings, and high risk findings so CI and GitHub Action consumers can make simple decisions without parsing Markdown.

The Markdown report is intended for maintainers. It uses a summary table, separate command tables for setup/agent/verify, changed files, diff summary, command output, and risk finding tables.
