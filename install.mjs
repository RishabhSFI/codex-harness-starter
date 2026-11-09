// Installs the pack into Codex. Run it through install.sh. Safe to rerun: every step converges.
//   sh install.sh [--dry-run]
// Writes, under CODEX_HOME (default ~/.codex): the rules block in AGENTS.md (your own lines
// outside the block stay), rules/harness.rules, agents/harness-reviewer.toml and the until-ready
// Stop hook in hooks.json. Copies the skills to ~/.agents/skills. Never edits config.toml.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = realpathSync(dirname(fileURLToPath(import.meta.url)));
const CODEX = process.env.CODEX_HOME || join(homedir(), '.codex');
const SKILLS = join(homedir(), '.agents', 'skills');
const DRY = process.argv.includes('--dry-run');
const START = '<!-- codex-harness:start';
const END = '<!-- codex-harness:end -->';
const SKILL_MARK = '.codex-harness';
const AGENT_MARK = '# codex-harness:';
const HOOK_MARK = 'codex-gate.mjs" hook';
let status = 0;

const render = (text) => text.split('{{HARNESS}}').join(HARNESS);
const read = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null);
const say = (line) => console.log(DRY ? `[dry-run] ${line}` : line);
const warn = (line) => {
  console.log(`warning: ${line}`);
  status = 1;
};

/** Writes `text` to `file` unless it already holds it. */
function put(file, text, what) {
  if (read(file) === text) return console.log(`unchanged ${what}`);
  say(`${existsSync(file) ? 'updated' : 'created'} ${what}`);
  if (DRY) return;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function* filesUnder(dir) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* filesUnder(path);
    else yield path;
  }
}

function yourFiles() {
  const projects = join(HARNESS, 'projects.json');
  if (!existsSync(projects)) put(projects, `${JSON.stringify({ projects: [], retired: [] }, null, 2)}\n`, `${projects} (your project list)`);
  const wiki = join(HARNESS, 'wiki');
  if (existsSync(wiki)) return console.log(`unchanged ${wiki} (your wiki)`);
  say(`created ${wiki} from starter-wiki/`);
  if (!DRY) cpSync(join(HARNESS, 'starter-wiki'), wiki, { recursive: true });
}

function agentsMd() {
  const file = join(CODEX, 'AGENTS.md');
  const block = `${START} (written by ${join(HARNESS, 'install.sh')}; edits inside this block are replaced on the next install) -->\n${render(readFileSync(join(HARNESS, 'global', 'AGENTS.md'), 'utf8')).trim()}\n${END}\n`;
  const old = read(file);
  const at = old?.indexOf(START) ?? -1;
  const end = old?.indexOf(END) ?? -1;
  let next;
  if (old === null || !old.trim()) next = block;
  else if (at === -1) next = `${old.replace(/\n*$/, '\n')}\n${block}`;
  else if (end < at) return warn(`${file} has a codex-harness start marker with no end marker; fix it by hand and rerun`);
  else next = `${old.slice(0, at)}${block}${old.slice(end + END.length).replace(/^\n/, '')}`;
  put(file, next, `${file} (the harness block)`);
  if (existsSync(join(CODEX, 'AGENTS.override.md'))) warn(`${join(CODEX, 'AGENTS.override.md')} exists, and Codex reads it instead of AGENTS.md. Move its lines into AGENTS.md, outside the harness block.`);
}

function skills() {
  for (const name of readdirSync(join(HARNESS, 'skills')).sort()) {
    const from = join(HARNESS, 'skills', name);
    const to = join(SKILLS, name);
    if (existsSync(to) && !existsSync(join(to, SKILL_MARK))) {
      warn(`${to} exists and isn't from this pack, left untouched`);
      continue;
    }
    const files = [...filesUnder(from)].map((f) => ({ rel: relative(from, f), bytes: readFileSync(f) }));
    for (const f of files) if (f.rel.endsWith('.md')) f.bytes = Buffer.from(render(f.bytes.toString('utf8')));
    files.push({ rel: SKILL_MARK, bytes: Buffer.from(`Installed by ${join(HARNESS, 'install.sh')}. Rerun it to update; delete this folder to remove the skill.\n`) });
    const have = existsSync(to) ? [...filesUnder(to)].map((f) => relative(to, f)).sort().join('\n') : null;
    const same = have === files.map((f) => f.rel).sort().join('\n') && files.every((f) => readFileSync(join(to, f.rel)).equals(f.bytes));
    if (same) {
      console.log(`unchanged skill ${to}`);
      continue;
    }
    say(`installed skill ${to}`);
    if (DRY) continue;
    rmSync(to, { recursive: true, force: true });
    for (const f of files) {
      mkdirSync(dirname(join(to, f.rel)), { recursive: true });
      writeFileSync(join(to, f.rel), f.bytes);
    }
  }
}

function rules() {
  put(join(CODEX, 'rules', 'harness.rules'), readFileSync(join(HARNESS, 'rules', 'harness.rules'), 'utf8'), join(CODEX, 'rules', 'harness.rules'));
}

function reviewerAgent() {
  const file = join(CODEX, 'agents', 'harness-reviewer.toml');
  const old = read(file);
  if (old !== null && !old.startsWith(AGENT_MARK)) return console.log(`unchanged ${file} (yours: its first line is no longer the codex-harness marker)`);
  put(file, readFileSync(join(HARNESS, 'agents', 'harness-reviewer.toml'), 'utf8'), file);
}

function stopHook() {
  const file = join(CODEX, 'hooks.json');
  const old = read(file);
  let config;
  try {
    config = old === null ? {} : JSON.parse(old);
  } catch (e) {
    return warn(`${file} is not valid JSON (${e.message}); left untouched, so the until-ready gate is not installed`);
  }
  config.hooks ??= {};
  const ours = { hooks: [{ type: 'command', command: `node "${join(HARNESS, 'gate', 'codex-gate.mjs')}" hook`, timeout: 1800, statusMessage: 'until-ready gate: running the project checks' }] };
  const others = (config.hooks.Stop ?? []).filter((group) => !(group.hooks ?? []).some((h) => String(h.command ?? '').includes(HOOK_MARK)));
  config.hooks.Stop = [...others, ours];
  const next = `${JSON.stringify(config, null, 2)}\n`;
  const backup = `${file}.before-harness`;
  if (old !== null && old !== next && !existsSync(backup) && !DRY) writeFileSync(backup, old);
  put(file, next, `${file} (the until-ready Stop hook)`);
}

function nextSteps() {
  console.log(`
Not changed: ${join(CODEX, 'config.toml')}. Settings are yours to choose. The ones the
harness expects are in ${join(HARNESS, 'config.toml.example')}; copy the lines you want.

Next, in Codex:
  1. Run /hooks and trust "until-ready gate". Codex skips a hook until you do,
     and asks again whenever install.sh changes it.
  2. Install pstack (see README.md, "Install").
  3. Restart Codex so it loads the rules file and the skills.
  4. In each project with a .claude/gate.json, read the file, then run
     node ${join(HARNESS, 'gate', 'codex-gate.mjs')} trust
     The hook runs a project's checks only after you have trusted its gate.json.`);
}

for (const step of [yourFiles, agentsMd, skills, rules, reviewerAgent, stopHook]) step();
nextSteps();
process.exitCode = status;
