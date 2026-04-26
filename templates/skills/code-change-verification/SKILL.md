---
name: code-change-verification
description: Verify AI-assisted code changes with focused tests and required repository checks.
---

# Code Change Verification

Use this skill when verifying code changes made by an AI coding agent.

## Workflow

1. Inspect the changed files and identify the behavior under test.
2. Run the narrowest relevant tests first.
3. Run the repository's required verification commands before finalizing.
4. Report what passed, what failed, what was skipped, and what risk remains.

Do not claim that verification guarantees safety.
