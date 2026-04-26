# Task Format

Benchmark tasks will be described in YAML and validated with `zod`.

```yaml
id: update-readme
title: Update README docs
description: Add missing usage notes.
setup:
  commands:
    - run: pnpm install --frozen-lockfile
      timeoutSeconds: 120
verify:
  commands:
    - run: pnpm test
      timeoutSeconds: 120
risk:
  forbidden_paths:
    - .github/
  max_files_changed: 20
  require_tests: true
```

`maintainerbench eval` takes the external agent command from `--agent-command` rather than hardcoding a model or agent. Task commands are shell strings run inside the temporary worktree. The schema still accepts the earlier `verify: [{ run: ... }]` shorthand.
