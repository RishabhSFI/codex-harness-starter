#!/usr/bin/env node
// The until-ready gate for Codex. Run it from the folder the work is in.
//   node codex-gate.mjs on "<the goal, in the owner's words>"   gate on for this worktree
//   node codex-gate.mjs off | status
//   node codex-gate.mjs check                                    run the checks once, now
//   node codex-gate.mjs trust                                    the owner approves this repo's .claude/gate.json
//   node codex-gate.mjs hook                                     the Stop hook install.sh registers
// Codex's Stop hook can send the agent back to work ({"decision": "block", "reason"}), as Claude
// Code's does, so qa-gate.mjs and until-ready.mjs run unchanged. The gate is keyed by the worktree
// instead of a session id, so `on` from the agent's shell and the hook agree without one.
// Two things stop a cloned repo from running commands through the hook. The key mixes in a secret
// made once per install (CODEX_HOME/codex-gate.key), so a repo can't ship a state file that arms
// the gate. And the hook runs a repo's gate.json steps only after the owner ran `trust` on its
// exact contents (CODEX_HOME/gate-trust.json), since an agent can write that file in a sandbox.
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const GATE = dirname(fileURLToPath(import.meta.url));

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

const toplevel = (cwd) => git(cwd, 'rev-parse', '--show-toplevel');
const codexHome = () => process.env.CODEX_HOME || join(process.env.HOME || '', '.codex');
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

/** The per-install secret, made on first use with mode 0600. */
function secret() {
  const file = join(codexHome(), 'codex-gate.key');
  if (!existsSync(file)) {
    mkdirSync(codexHome(), { recursive: true });
    try {
      writeFileSync(file, randomBytes(16).toString('hex'), { mode: 0o600, flag: 'wx' });
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }
  chmodSync(file, 0o600);
  return readFileSync(file, 'utf8').trim();
}

const keyOf = (top, prefix = 'codex') => `${prefix}-${sha256(`${secret()}\0${top}`).slice(0, 16)}`;
const mainCheckout = (top) => dirname(resolve(top, git(top, 'rev-parse', '--path-format=absolute', '--git-common-dir')));

/** A state file the repo tracks came from its authors, not from this install's `on`. */
function committedState(top) {
  return git(mainCheckout(top), 'ls-files', '--error-unmatch', '--', join('.claude', 'loop', `${keyOf(top)}.json`)) !== null;
}

/** qa-gate runs the gate.json in the state file's `dir`, which an agent's shell could have written, so it must be this checkout. */
function stateDirIs(top) {
  try {
    const state = JSON.parse(readFileSync(join(mainCheckout(top), '.claude', 'loop', `${keyOf(top)}.json`), 'utf8'));
    return typeof state.dir === 'string' && realpathSync(state.dir) === realpathSync(top);
  } catch (e) {
    return e?.code === 'ENOENT' && e.path !== undefined && String(e.path).endsWith(`${keyOf(top)}.json`);
  }
}

const trustFile = () => join(codexHome(), 'gate-trust.json');
const gateFile = (top) => join(top, '.claude', 'gate.json');

const repoId = (top) => realpathSync(mainCheckout(top));

/** Trust belongs to a repo (its main checkout, which its worktrees share) and a file's exact bytes, so the same bytes in another repo are not trusted. */
function trustedHashes(top) {
  try {
    return Object.keys(JSON.parse(readFileSync(trustFile(), 'utf8')).trusted?.[repoId(top)] ?? {});
  } catch {
    return [];
  }
}

/** Null when the repo's gate.json is trusted, else the note for the owner. */
function untrustedNote(top) {
  if (trustedHashes(top).includes(existsSync(gateFile(top)) ? sha256(readFileSync(gateFile(top))) : '')) return null;
  return `codex-gate: ${gateFile(top)} is not trusted, so its checks did not run. Read it, then run: node ${join(GATE, 'codex-gate.mjs')} trust (from ${top}). It must be run again whenever the file changes.`;
}

function trust(top) {
  if (!existsSync(gateFile(top))) {
    console.error(`codex-gate: ${gateFile(top)} does not exist, so there is nothing to trust.`);
    return 2;
  }
  const text = readFileSync(gateFile(top));
  let record = {};
  try {
    record = JSON.parse(readFileSync(trustFile(), 'utf8'));
  } catch {}
  const id = repoId(top);
  record.trusted = { ...record.trusted, [id]: { ...record.trusted?.[id], [sha256(text)]: { path: gateFile(top), at: new Date().toISOString() } } };
  mkdirSync(codexHome(), { recursive: true });
  writeFileSync(trustFile(), `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  console.log(`Trusted ${gateFile(top)} (sha256 ${sha256(text).slice(0, 12)}). The Stop hook will run its steps.`);
  return 0;
}

function runGate(input) {
  return spawnSync(process.execPath, [join(GATE, 'qa-gate.mjs')], { input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 64 << 20 });
}

function hook() {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {}
  const top = toplevel(input.cwd || process.cwd());
  const note = top && existsSync(gateFile(top)) && untrustedNote(top);
  if (note) process.stderr.write(`${note}\n`);
  const out = top && existsSync(gateFile(top)) && !note && !committedState(top) && stateDirIs(top) ? runGate({ ...input, session_id: keyOf(top), cwd: top }).stdout.trim() : '';
  console.log(out || '{}');
  return 0;
}

function check(top) {
  const note = untrustedNote(top);
  if (note) {
    console.error(note);
    return 2;
  }
  const key = keyOf(top, 'check');
  const state = join(mainCheckout(top), '.claude', 'loop', `${key}.json`);
  const on = spawnSync(process.execPath, [join(GATE, 'until-ready.mjs'), 'on', 'one manual check'], { cwd: top, encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_SESSION_ID: key } });
  if (on.status !== 0) {
    process.stderr.write(on.stderr);
    return on.status ?? 2;
  }
  try {
    const r = runGate({ session_id: key, cwd: top });
    const reason = JSON.parse(r.stdout || '{}').reason ?? r.stderr;
    const passed = reason.startsWith('Gate passed');
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${reason.replace(/^Gate, try \d+ of \d+: /, '')}`);
    return passed ? 0 : 1;
  } finally {
    rmSync(state, { force: true });
  }
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'hook') return hook();
  const top = toplevel(process.cwd());
  if (!top) {
    console.error('codex-gate: run this inside the git checkout or worktree the work is in.');
    return 2;
  }
  if (cmd === 'check') return check(top);
  if (cmd === 'trust') return trust(top);
  if (!['on', 'off', 'status'].includes(cmd)) {
    console.error('usage: node codex-gate.mjs on "<goal>" | off | status | check | trust | hook');
    return 2;
  }
  const r = spawnSync(process.execPath, [join(GATE, 'until-ready.mjs'), cmd, ...rest], { cwd: top, stdio: 'inherit', env: { ...process.env, CLAUDE_CODE_SESSION_ID: keyOf(top) } });
  const note = cmd === 'on' && r.status === 0 && untrustedNote(top);
  if (note) console.log(`\n${note}\nAsk the owner to run that command; do not run it yourself.`);
  if (cmd === 'on' && r.status === 0 && !hookInstalled()) {
    console.log(`\nThe Stop hook isn't in ${hooksFile()}, so nothing checks your turns. Run install.sh, or run "node ${join(GATE, 'codex-gate.mjs')} check" before you end each turn.`);
  }
  return r.status ?? 2;
}

const hooksFile = () => join(codexHome(), 'hooks.json');

function hookInstalled() {
  try {
    return existsSync(hooksFile()) && readFileSync(hooksFile(), 'utf8').includes('codex-gate.mjs');
  } catch {
    return false;
  }
}

process.exitCode = main();
