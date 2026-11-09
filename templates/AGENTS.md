# <Project name>

<What it is, in one line.>

## Public

What counts as public here. Anything on this list needs the owner's
go-ahead in the session; everything else is fine to merge, push and deploy.

- The `main` branch (the host deploys it).
- `<the production deploy command>`.
- <Anything that emails or messages people.>

## Checks

The gate is `.claude/gate.json`. `$until-ready` runs it.

## Rules

- <Files or folders not to touch.>
- <Commands never to run.>
