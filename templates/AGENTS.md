# Repository Agent Instructions

## Purpose

Describe what this repository does, who maintains it, and what changes are safe for AI coding agents to attempt.

## Boundaries

- Keep file writes inside this repository.
- Do not read secrets, credentials, SSH keys, cloud credentials, or files from home directories.
- Do not approve, merge, or auto-accept pull requests.
- Prefer small, reviewable changes with tests.
- Explain skipped checks and residual risk in reports.

## Verification

Before declaring work complete, run the commands listed by the maintainer for this repository. Add project-specific commands here.

```bash
pnpm test
```
