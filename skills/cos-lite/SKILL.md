---
name: cos-lite
description: A small Chief of Staff for Codex. Status of every project in the harness's projects.json, starting work in one, and adding a new project. Use for "status of everything", "where do my projects stand", "what needs me", "tell <project> to ...", "start a new project".
---

# Chief of Staff, lite

Below, `H` means the harness folder, `{{HARNESS}}`. The project list is
`H/projects.json` (each project has `id`, `name`, `what`, `checkouts`,
`repos` and `public`; `H/projects.example.json` shows one).

## Status of everything

For each project:

1. In each checkout: `git -C <checkout> status --short --branch` and
   `git -C <checkout> log -1 --format='%h %s (%cr)'`.
2. For each repo: `gh pr list -R <repo> --state open --json number,title,isDraft,reviewDecision,statusCheckRollup`.
3. Its wiki page (`node H/wiki.mjs page <id>`): the Open items list.

Report one line per project, sorted: PRs waiting on the owner first, then
failing checks or blocked work, then quiet projects. Keep it short. Run the
reads in subagents when there are more than a few projects.

## Tell a project to do something

Codex can't open or message another interactive session. Write a brief
(the owner's words quoted exactly, "read the project's wiki page first",
"use $until-ready if it has a gate", "end in a PR, never publish", "build
only what was asked, report with an Asked vs delivered section and a
$scope-review verdict") and pick one. Don't widen the ask: the brief adds no
roles, counts, phases or questions to answer that the owner didn't raise;
gaps the owner left open go in it as questions to bring back.

- **The owner watches it:** give them the command to paste:
  `codex -C <checkout> "<brief>"`.
- **It runs headless:** `codex exec -C <checkout> --sandbox workspace-write "<brief>"`.
  Codex asks first, since it works outside this folder. The worker reads
  the same AGENTS.md rules. Its last message is its report.

When the worker's PR is up, check it (`gh pr view -R <repo> <n>`), make
sure an independent review ran, and update the project's wiki page.

Before telling the owner any deliverable is done (code, doc, page, plan,
email), read its "Asked vs delivered" section against the owner's words
and open the deliverable itself. Reject it and send it back if any part of
the `$scope-review` shape is missing, the verdict isn't "Scope review:
pass", or the work holds anything the owner didn't ask for. When it passes, ask the owner its open questions
first; work that depends on an unanswered question isn't done.

## Start a new project

1. `mkdir ~/Projects/<slug> && git -C ~/Projects/<slug> init`.
2. Add an entry to `H/projects.json`, shaped like the example. Fill in
   `public` with what goes live (the branch, the deploy command).
3. `node H/wiki.mjs new-page <slug>`, then copy
   `H/templates/AGENTS.md` into the new folder and fill it in.

## Chat size

This hub is one permanent chat. Once it has used about 80k tokens more
than it had at the start, write the handoff (`reports/cos-handoff-<date>.md`)
and keep working in the same chat; Codex compacts it. Never end a turn or
start another hub because of the count.

## What this can't do

There is no list of running sessions, no sidebar and no way to wake a
worker. The owner opens sessions; this skill writes their briefs and
checks their results.
