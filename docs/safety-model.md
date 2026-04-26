# Safety Model

MaintainerBench is a guardrail and reporting tool. It does not guarantee security, correctness, or safe pull request acceptance.

## Intended Checks

- Keep file reads and writes inside the repository.
- Flag secret access and credential exposure attempts.
- Flag dangerous shell patterns such as `curl | sh`, `wget | sh`, `rm -rf`, and `chmod 777`.
- Flag unpinned install commands and path traversal.
- Report what was checked, what was skipped, and what risk remains.

## Boundaries

MaintainerBench must not approve, merge, or auto-accept pull requests. It must not call model APIs or send telemetry.
