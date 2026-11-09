# Rules for every session

From the Codex starter pack in `{{HARNESS}}`. Project AGENTS.md files add to
these. Below, "the owner" is the person you work for.

- **Right folder first.** If the request is about one of the projects in
  `{{HARNESS}}/projects.json` and this session runs in another folder, say
  so in the first reply and ask the owner to start Codex in that project
  (`codex -C <checkout>`) before doing any work.
- **New sites and apps get a real folder.** If the request is to build a
  website or app and this session has no project folder, make
  `~/Projects/<name>` first (with `git init`) and continue in a Codex
  session started there. Codex asks before writing outside the session's
  folder, so make the folder, then hand over.
- **Done for UI or wording changes.** In any project, run the unslop skill
  (`$unslop`, from pstack) on the changed screens and a pstack review of
  the diff, then say what each one changed.
- **Loop until ready.** When the owner asks to build or fix something and
  the project has a gate (`.claude/gate.json`), use `$until-ready`. Don't stop to ask about routine
  choices; decide and say what you decided.
- **Build with pstack.** For anything beyond a one-line change, use
  `$poteto-mode` and follow its playbook: design first, delegated build,
  independent review before the PR. Its Codex notes (subagents, model
  names) are in its `references/codex-tools.md`.
- **Ask the wiki first.** For past decisions, people, terms or a project's
  state, read the wiki (`$wiki`) before you guess, and update the project's
  page when work lands.
- **Spend usage where it counts.** Most usage is long chats re-reading
  themselves.
  - **One task per session.** When a task ends in a PR, it's done. New
    work goes to a fresh session with a short brief, and the project's
    wiki page carries the history.
  - **Write your state at about 80k tokens.** Once a chat has used about
    80k tokens more than it had at the start (`/status` shows the count),
    write your state (goal, branch, done, next step) to the project's
    wiki page or the notes folder, then keep working in the same chat;
    Codex compacts it. Never end a turn or stop work because of the
    count.
  - **Keep the main chat small.** Hand building, long reads and big
    outputs to subagents, and summarize what comes back.
  - **Read old chats in a subagent.** Past sessions are under
    `~/.codex/sessions`. Search them in a subagent on a fast model and
    bring back a short answer with quotes, never the raw logs.
  - **End a turn only when it matters.** End your turn only when the PR is
    ready, you're blocked, or you have a question for the owner. While
    subagents run, wait for them; never end a turn with a status-only
    message.
  - **Size reviews.** A fast reviewer model for small, low-risk diffs
    (under about 150 lines, no auth, money, data deletion or merge
    logic); your strongest model for large or risky ones.
- **Security audit before a PR.** Before opening a PR, run
  `node {{HARNESS}}/gate/codex-audit.mjs` in the work folder. Skip it when
  the project's gate already has the step, since the gate ran it. Fix
  every confirmed high or critical finding. List everything else it found
  in the PR under "Security audit", or write "Security audit: no
  findings". Run the full six-phase audit (`$security-audit`, full audit
  mode) only when the owner asks or before a project first goes public.
- **Always review.** Nothing merges without an independent review by a
  model that didn't write the change: the `harness_reviewer` subagent, or
  a second `codex exec` on another model (`$independent-review` has both).
  The PR says which reviewer ran and what it found. If none ran, run one
  before merging into a project's default or live branch.
- **Releases.** Merging, pushing and deploying are fine unless the result
  is publicly visible. Public means what the project's AGENTS.md or the
  `public` entry in `{{HARNESS}}/projects.json` lists (usually: the branch
  that goes live, `vercel deploy --prod`, live database changes, anything
  that emails or messages people). Those need the owner's go-ahead in this
  session; open a PR with a preview link and stop there. If a project
  declares nothing, all of these are public: a production deploy, a push
  or merge into the default branch, publishing a package or post, and
  anything that emails or messages people. When unsure, treat it as
  public. `~/.codex/rules/harness.rules` makes Codex ask before the common
  ones and refuses force pushes (`$release-rules`).
- **GitHub: your own repo only.** Pass `-R <owner/repo of origin>` to every
  `gh pr` and `gh repo` command, and push only to `origin`. Some folders
  also have an `upstream` remote that is someone else's public repo; never
  push, open a PR or comment there.
- **All my projects at once.** For "status of everything", "tell
  <project> to ..." or "start a new project", use `$cos-lite`.
