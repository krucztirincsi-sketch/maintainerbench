# Task Format

Benchmark tasks will be described in YAML and validated with `zod`.

```yaml
id: update-readme
title: Update README docs
description: Add missing usage notes.
agent:
  command: codex
verify:
  - run: pnpm test
    timeoutSeconds: 120
```

The current scaffold includes a minimal schema parser. Full task execution is not implemented yet.
