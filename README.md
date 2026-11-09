# codex-harness

A way of working for OpenAI Codex, generated from a Claude Code harness. It
gives every Codex session the same rules: work in the right folder, keep
going until the project's checks pass, audit and review every change
before its PR, and never put anything public out without your go-ahead.

What's in here:

- `global/AGENTS.md`: rules for every session. `install.sh` puts them in
  `~/.codex/AGENTS.md`, inside a marked block, beside your own lines.
- `skills/`: `until-ready`, `wiki`, `security-audit`,
  `independent-review`, `release-rules` and `cos-lite`, in Codex's skill
  format. Call one with `$<name>`, or let Codex pick it from the request.
- `gate/`: the until-ready gate (`codex-gate.mjs`, a Codex Stop hook) and
  the security audit (`codex-audit.mjs`, run by `codex exec` read-only).
- `rules/harness.rules`: Codex rules that refuse the common force-push
  spellings and ask you before a push to `main`, a merge, a production
  deploy or a package publish. Prefix rules miss some spellings (a bare
  `git push` on main, `git push -u origin main`), so the AGENTS.md release
  rule still applies.
- `agents/harness-reviewer.toml`: a reviewer subagent that reads a diff it
  didn't write.
- `wiki.mjs` and `starter-wiki/`: a wiki your sessions keep, so facts
  survive from one chat to the next.
- `templates/`: a project `AGENTS.md` and `.claude/gate.json` to start from.
- `config.toml.example`: Codex settings that suit all this. You copy them;
  nothing edits your `config.toml`.
- `PORTING.md`: what carried over from the Claude Code harness, what
  didn't, and which Codex docs each part rests on.

## What you need

- The Codex CLI, signed in (`codex login`, then `codex login status`).
- Node 20 or newer (`node --version`).
- The GitHub CLI, signed in (`gh auth login`, then `gh auth status`).

## Install

1. Clone the pack. `~/Projects/codex-harness` is the suggested folder (the
   gate template names it), but any folder works:

   ```
   git clone https://github.com/RishabhSFI/codex-harness-starter.git ~/Projects/codex-harness
   cd ~/Projects/codex-harness
   ```

2. See what the installer will do, then run it:

   ```
   sh install.sh --dry-run
   sh install.sh
   ```

   It writes the rules block into `~/.codex/AGENTS.md`, the rules file to
   `~/.codex/rules/`, the reviewer to `~/.codex/agents/`, and the Stop hook
   to `~/.codex/hooks.json` (it keeps a `.before-harness` copy of the old
   one). It copies the skills to `~/.agents/skills/`, and makes your
   `projects.json` and `wiki/` in this folder. It is safe to run again,
   and it leaves alone any skill or file that isn't its own. Set
   `CODEX_HOME` to install somewhere other than `~/.codex`.

3. Open `config.toml.example` and copy the lines you want into
   `~/.codex/config.toml`.

4. Install pstack, the way of working the rules point to (design first,
   delegated build, independent review). In a terminal:

   ```
   codex plugin marketplace add michael-denyer/pstack-claude
   codex plugin add pstack@pstack-claude
   ```

   Then, in Codex, run `$setup-pstack` to pick your models. It writes
   `~/.codex/pstack-models.md`.

   Without plugins, link the skills instead: clone
   `https://github.com/michael-denyer/pstack-claude` and link each folder
   under `plugins/pstack/skills/` into `~/.agents/skills/`. Its README has
   the loop.

5. Start Codex, run `/hooks`, and trust "until-ready gate" (and pstack's
   "Loading pstack routing" hook if you installed the plugin). Codex skips
   a hook until you trust it, and asks again when it changes.

## Use it

- "Add a dark mode to the recipe app, `$until-ready`": the session makes a
  worktree, turns the gate on, and can't end a turn until the project's
  checks in `.claude/gate.json` pass, up to 5 tries. A project with no gate
  gets a draft one first, for you to approve.
- "What did we decide about the logo?": the `wiki` skill reads the wiki
  first.
- "Status of everything": `cos-lite` lists open PRs and blocked work for
  every project in `projects.json`.

The gate runs the commands in a project's `.claude/gate.json` from a hook,
so it won't run a file you haven't approved. A repo you clone, or a
sandboxed agent, could put anything in it. Read the file, then run
`node gate/codex-gate.mjs trust` in the project; that records the file's
hash in `~/.codex/gate-trust.json`, and you run it again when the file
changes. Trust covers the file, not the code its commands run, so trust only
repos you trust. Until then the hook does nothing and tells you so. The gate's state
files are keyed with a secret made once at `~/.codex/codex-gate.key`, so a
repo can't ship one that arms the hook.

To check a change by hand: `node gate/codex-gate.mjs check` in the project
runs the gate once, and `node gate/codex-audit.mjs` audits the diff.

## Your files

`projects.json`, `wiki/` and `reports/` are yours. Git ignores them and
updates never touch them. Keep them in a private repo if you want them
backed up. The wiki holds notes about real people, so never make it public.

## Updates

```
git pull
sh install.sh
```

## Remove it

Delete the block between the `codex-harness:start` and `codex-harness:end`
lines in `~/.codex/AGENTS.md`, the `codex-gate.mjs` entry in
`~/.codex/hooks.json`, `~/.codex/rules/harness.rules`,
`~/.codex/agents/harness-reviewer.toml`, and each `~/.agents/skills/<name>`
folder that has a `.codex-harness` file in it.
