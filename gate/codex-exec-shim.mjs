#!/usr/bin/env node
// Stands in for the CLI that security-audit.mjs calls. It reads the prompt (-p), the result
// schema (--json-schema) and the diff on stdin, runs `codex exec` in a read-only sandbox, and
// prints the one envelope security-audit.mjs parses: {"structured_output": {...}}. The model
// name security-audit.mjs passes is for the other CLI and is ignored; set CODEX_AUDIT_MODEL to
// choose one. CODEX_BIN overrides the codex binary.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
};

/** Structured output wants every object closed and every key required, and a type beside a null in an enum. */
function strict(schema) {
  if (Array.isArray(schema)) return schema.map(strict);
  if (!schema || typeof schema !== 'object') return schema;
  const out = Object.fromEntries(Object.entries(schema).map(([k, v]) => [k, strict(v)]));
  if (out.type === 'object' && out.properties) {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties);
  }
  if (Array.isArray(out.enum) && !out.type) {
    const types = [...new Set(out.enum.map((v) => (v === null ? 'null' : typeof v)))];
    out.type = types.length === 1 ? types[0] : types;
  }
  return out;
}

/** @returns {[object, number]} the envelope and the exit code */
function audit(prompt, schema) {
  if (!prompt || !schema) return [{ is_error: true, result: 'codex-exec-shim: expected -p <prompt> and --json-schema <schema>' }, 2];
  const dir = mkdtempSync(join(tmpdir(), 'codex-audit-'));
  try {
    const schemaFile = join(dir, 'schema.json');
    const outFile = join(dir, 'last-message.json');
    writeFileSync(schemaFile, JSON.stringify(strict(JSON.parse(schema))));
    const model = process.env.CODEX_AUDIT_MODEL;
    const run = spawnSync(
      process.env.CODEX_BIN || 'codex',
      ['exec', '--sandbox', 'read-only', '--ephemeral', '--skip-git-repo-check', '-c', 'approval_policy="never"', '--output-schema', schemaFile, '-o', outFile, ...(model ? ['-m', model] : []), prompt],
      { input: process.stdin.isTTY ? '' : readFileSync(0), encoding: 'utf8', maxBuffer: 64 << 20 },
    );
    if (run.error || run.status !== 0 || !existsSync(outFile)) {
      const why = run.error?.message ?? `${run.stderr || ''}${run.stdout || ''}`.trim().split('\n').slice(-6).join('\n');
      return [{ is_error: true, result: `codex exec failed (exit ${run.status}): ${why}` }, 1];
    }
    return [{ structured_output: JSON.parse(readFileSync(outFile, 'utf8')) }, 0];
  } catch (e) {
    return [{ is_error: true, result: `codex-exec-shim: ${e.message}` }, 1];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const [result, code] = audit(valueOf('-p'), valueOf('--json-schema'));
console.log(JSON.stringify(result));
process.exitCode = code;
