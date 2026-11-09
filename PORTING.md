# Porting notes

This pack is generated from a Claude Code harness by `make-codex-starter.mjs`.
The gate, audit and wiki scripts are the harness's own files, unchanged. The
`until-ready` and `wiki` skills are the harness's skills with Codex edits.
Everything Codex-specific (the installer, three small gate adapters, the
other skills, AGENTS.md, the rules) is written for Codex. The generator
stops if a harness rule has no line in `global/AGENTS.md` or a skill edit no
longer applies, so the pack can't quietly fall behind the harness.

## What ports

| Harness piece | In Codex |
|---|---|
| Global `CLAUDE.md` | `~/.codex/AGENTS.md`, in a marked block. Codex reads `AGENTS.override.md` instead when that exists, so the installer warns about it. |
| Skills (`~/.claude/skills`) | `~/.agents/skills/<name>/SKILL.md`, same frontmatter (`name`, `description`). Called with `$<name>`. |
| until-ready Stop hook | A Codex `Stop` hook in `~/.codex/hooks.json`. Codex continues the agent with the hook's `reason` when it returns `{"decision": "block"}`, like Claude Code, so the harness's `qa-gate.mjs` runs unchanged behind `gate/codex-gate.mjs`. The gate is keyed by worktree, not session id. |
| Gate file `.claude/gate.json` | Kept as is, so one gate serves a project in both tools. |
| Hook trust | Claude Code's gate runs in a session the owner started. Codex's Stop hook fires in any repo, so a cloned repo's `.claude/gate.json` would run its commands unreviewed, and an agent in a sandbox can write that file. `codex-gate.mjs trust`, run by the owner, records the file's sha256 in `$CODEX_HOME/gate-trust.json`; the hook and `check` do nothing until the current hash is listed. The state-file key also mixes in a per-install secret (`$CODEX_HOME/codex-gate.key`, mode 0600), and the hook ignores a state file git tracks, so a repo can't ship one that arms it. Trust covers the file's bytes only: the commands in it run unsandboxed and execute whatever repo files they name, so trust a gate.json only for a repo you trust. |
| Security audit (`claude -p`) | `gate/codex-audit.mjs` runs the harness's `security-audit.mjs` with `gate/codex-exec-shim.mjs` as its CLI, which runs `codex exec --sandbox read-only --output-schema`. |
| Independent review subagent | The `harness_reviewer` custom agent (`~/.codex/agents/`), or a second `codex exec -m <other model>`. |
| Release rules (prose only) | Prose in AGENTS.md, plus `rules/harness.rules`: `prefix_rule`s that forbid force pushes and ask before a push to `main`, a merge, a production deploy or a publish. |
| Wiki | `wiki.mjs` and the wiki skill, with the one import of the Chief of Staff script replaced by a plain `gh` lookup. |
| Chief of Staff | `cos-lite`: status from `projects.json`, `git` and `gh`, and briefs for workers you start with `codex -C` or `codex exec -C`. |
| pstack | pstack ships a native Codex plugin (`codex plugin add pstack@pstack-claude`) with the same skills and a `SessionStart` routing hook. |

## What doesn't port

- **Starting and messaging sessions.** The Claude desktop app lets the hub
  start worker chats, message them and file them in sidebar groups. Codex
  has no such tools, so `cos-lite` writes the brief and you start the
  session, or it runs a headless `codex exec`.
- **Mission control**, the local dashboard, is left out.
- **The prompt hook** that warns about the wrong folder and chat size. The
  rules ask the agent to check both itself, and at about 80k tokens of
  growth to write its state to the wiki or notes and keep working in the
  same chat, which Codex compacts. Codex has a `UserPromptSubmit`
  hook that could carry it later.
- **The history-reader agent** on a cheap Claude model. The rule now says
  to search `~/.codex/sessions` in a subagent.
- **Usage limits and paused-session resume**, which read Claude Code's own
  files.
- **The secrets page, the daily review and `cos update`.** Updates are
  `git pull` and `sh install.sh`.
- **Model names.** Claude model names mean nothing to Codex. Set your own in
  `harness-reviewer.toml`, `CODEX_AUDIT_MODEL` and `$setup-pstack`.

## Codex docs this rests on

`developers.openai.com/codex/...` pages now redirect to
`learn.chatgpt.com/docs/...`. Each fact below was read there, on
2026-11-09, unless it says otherwise.

- AGENTS.md discovery, `AGENTS.override.md`, `project_doc_max_bytes`
  (32 KiB default): learn.chatgpt.com/docs/agent-configuration/agents-md
- config.toml keys (`approval_policy`, `sandbox_mode`,
  `[sandbox_workspace_write]`, `[features]`, `[agents]`, `notify`):
  https://developers.openai.com/codex/config-reference (now
  learn.chatgpt.com/docs/config-file/config-reference). Profiles are
  separate `~/.codex/<name>.config.toml` files since Codex 0.134; the old
  `[profiles.<name>]` tables are gone.
- Hooks (`hooks.json`, `Stop` with `decision: "block"`, trust through
  `/hooks`): learn.chatgpt.com/docs/hooks
- Skills (`~/.agents/skills`, `.agents/skills` in a repo, `$name`):
  learn.chatgpt.com/docs/build-skills
- Custom prompts (`~/.codex/prompts`) are deprecated in favor of skills, so
  the pack ships none: learn.chatgpt.com/docs/custom-prompts
- Subagents and custom agents (`~/.codex/agents/*.toml` with `name`,
  `description`, `developer_instructions`): learn.chatgpt.com/docs/agent-configuration/subagents
- Rules (`prefix_rule`, `~/.codex/rules/*.rules`, `codex execpolicy
  check`), marked experimental: learn.chatgpt.com/docs/agent-configuration/rules
- Plugins and marketplaces: learn.chatgpt.com/docs/plugins
- `codex exec` (`--sandbox`, `--output-schema`, `-o`, `--ephemeral`,
  `--skip-git-repo-check`, stdin as extra context):
  learn.chatgpt.com/docs/non-interactive-mode
- pstack on Codex: https://github.com/michael-denyer/pstack-claude (README,
  "Install", and `docs/reference.md`, "Codex").

## Not verified

The pack was built and installed into a scratch `CODEX_HOME` and its tests
run against stand-in `codex` binaries. It was not run against a real Codex,
so these rest on the docs alone:

- That Codex accepts `{}` from a `Stop` hook that has nothing to say.
- That `codex exec` takes `--output-schema` with the audit's schema. The
  shim closes every object and marks every key required, as structured
  output wants.
- That a custom agent name may contain an underscore (`harness_reviewer`).
- That `/status` shows the session's token count.
- The exact `prefix_rule` behavior. The rules file carries `match` and
  `not_match` examples, which Codex checks when it loads the file; run
  `codex execpolicy check` on it once after installing.
