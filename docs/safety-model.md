# Safety Model

MaintainerBench is a guardrail and reporting tool. It does not guarantee security, correctness, or safe pull request acceptance.

## Intended Checks

- Keep file reads and writes inside the repository.
- Flag secret access and credential exposure attempts.
- Flag dangerous shell patterns such as `curl | sh`, `wget | sh`, `rm -rf`, and `chmod 777`.
- Flag unpinned install commands and path traversal.
- Report what was checked, what was skipped, and what risk remains.

## Lint Scope

`maintainerbench lint` inspects repository-level AI-agent workflow files:

- `AGENTS.md`
- `.agents/**/SKILL.md`
- `.codex/config.toml`
- `.mcp.json` and `mcp.json`
- `.github/workflows/*.yml`
- `.maintainerbench/config.yml`

The lint command checks that `AGENTS.md` exists, includes setup/build/test instructions, and includes safety or security guidance. It also checks that repo-local `SKILL.md` files begin with YAML frontmatter containing `name` and `description`.

## Lint Rule Categories

- Repository guidance: `agents.missing`, `agents.missing-verification-guidance`, and `agents.missing-safety-guidance`.
- Skill metadata: `skill.missing-frontmatter`, `skill.invalid-frontmatter`, `skill.missing-name`, and `skill.missing-description`.
- Dangerous commands: `dangerous-command.rm-rf`, `dangerous-command.curl-pipe-sh`, `dangerous-command.wget-pipe-sh`, `dangerous-command.chmod-777`, `dangerous-command.sudo`, `dangerous-command.dd-if`, `dangerous-command.mkfs`, and `dangerous-command.fork-bomb`.
- Secret-looking paths: `secret-path.dotenv`, `secret-path.secrets-directory`, `secret-path.credentials`, `secret-path.id-rsa`, and `secret-path.private-key`.
- Workflow permissions: `workflow-permissions.write-all`, `workflow-permissions.contents-write`, `workflow-permissions.pull-requests-write`, `workflow-permissions.actions-write`, `workflow-permissions.issues-write`, and `workflow-permissions.packages-write`.
- Unpinned installs: `install.unpinned-npm-install`, `install.unpinned-pnpm-install`, `install.unpinned-yarn-install`, and `install.unpinned-bun-install`.

High severity findings include missing `AGENTS.md`, dangerous shell patterns, likely secret paths, and the broadest workflow write permissions such as `permissions: write-all`. Warning findings include missing guidance, invalid skill frontmatter, narrower workflow write permissions, and unpinned install patterns such as `npm install` in automation without lockfile guidance.

Human-readable output is the default. `maintainerbench lint --json` emits parseable JSON for CI and tooling. The command exits non-zero when high severity findings are present.

## Boundaries

MaintainerBench must not approve, merge, or auto-accept pull requests. It must not call model APIs or send telemetry.
