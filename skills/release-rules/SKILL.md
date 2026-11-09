---
name: release-rules
description: What counts as public (and needs the owner's go-ahead) and how the Codex rules file enforces it. Use before a merge, push to a default branch, production deploy, package publish, live database change or any message to people, or when Codex asks to approve one of those commands.
---

# Release rules

Merging, pushing and deploying are fine unless the result is publicly
visible. Public means what the project's AGENTS.md or its `public` entry in
`{{HARNESS}}/projects.json` lists. If neither says, all of these are
public: a production deploy, a push or merge into the default branch,
publishing a package or post, a live database change, and anything that
emails or messages people. When unsure, treat it as public.

Public steps need the owner's go-ahead in this session. Without it, push a
branch, open a PR with a preview link (`gh pr create -R <owner/repo of
origin>`), and stop there.

## What Codex enforces

`~/.codex/rules/harness.rules` (from `{{HARNESS}}/rules/harness.rules`)
holds Codex `prefix_rule`s:

- **Forbidden:** force pushes (`git push --force`, `-f`,
  `--force-with-lease`, `--mirror`, `git push origin +main`) and any push
  to `upstream`.
- **Ask first:** `git push origin main` or `master` (and `HEAD:main`),
  `gh pr merge`, `gh repo create`, `vercel --prod`, `vercel deploy --prod`,
  `npm`/`pnpm`/`yarn publish`.

A rule matches the start of a command, so it can't catch every spelling
(`git -C dir push`, `--force-with-lease=<ref>`, a script that pushes). The rule in AGENTS.md is the real
rule; the rules file is a seat belt. Check a command against it:

```bash
codex execpolicy check --pretty --rules ~/.codex/rules/harness.rules -- git push origin main
```

A project can add its own rules (its live deploy command, its database
migration) in `.codex/rules/<name>.rules` in its repo. Codex reads them
only once the owner trusts the project.
