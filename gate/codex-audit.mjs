#!/usr/bin/env node
// Security audit of one change, with Codex as the auditor. Same arguments and exit codes as
// security-audit.mjs (0 pass, 1 fail, 2 could not run), which this runs unchanged:
//   node codex-audit.mjs [--base <ref>] [--fail-on critical|high|medium|low|none] [--json]
// security-audit.mjs drives the CLI named in CLAUDE_BIN. codex-exec-shim.mjs takes that CLI's
// arguments and runs `codex exec` read-only instead. CODEX_AUDIT_MODEL picks the model.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const gate = dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath, [join(gate, 'security-audit.mjs'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, CLAUDE_BIN: join(gate, 'codex-exec-shim.mjs') },
});
process.exit(r.status ?? 2);
