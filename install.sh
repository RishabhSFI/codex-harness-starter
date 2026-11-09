#!/bin/sh
# Installs the Codex starter pack into ~/.codex (or $CODEX_HOME) and ~/.agents/skills.
# Safe to rerun. Pass --dry-run to only print what it would do. install.mjs does the work.
set -eu
command -v node >/dev/null 2>&1 || { echo 'install.sh: needs Node 20 or newer (node --version)' >&2; exit 1; }
exec node "$(cd "$(dirname "$0")" && pwd -P)/install.mjs" "$@"
