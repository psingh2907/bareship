#!/usr/bin/env bash
# Strips the demo content from a scratch copy and runs the checks on it, so `pnpm strip-examples` keeps
# working as the demo changes (ADR 0001). The copy shares node_modules through a symlink, so it calls the
# tools directly: a pnpm command there would reinstall packages through the link.
set -euo pipefail
cd "$(dirname "$0")/../.."
root="$PWD"
copy="$(mktemp -d)"
trap 'rm -f "$copy/node_modules"; rm -rf "$copy"' EXIT

rsync -a --exclude node_modules --exclude .git --exclude ios --exclude android --exclude vendor \
  --exclude coverage --exclude build --exclude dist --exclude website ./ "$copy/"
ln -s "$root/node_modules" "$copy/node_modules"
cd "$copy"
bin=node_modules/.bin

"$bin/tsx" scripts/strip-examples.ts
if grep -rEn '(//|/\*)\s*@example' src scripts --include='*.ts' --include='*.tsx' | grep -v 'scripts/strip-examples.ts'; then
  echo "✖ Example markers left after stripping"; exit 1
fi
"$bin/tsc" --noEmit
"$bin/eslint" . --max-warnings=0
"$bin/prettier" --check . --log-level warn
"$bin/depcruise" src --config .dependency-cruiser.cjs
# A fresh copy has a cold Jest cache, so the full-app tests compile everything on their first run.
"$bin/jest" --ci --testTimeout=20000
echo "✔ The stripped app passes types, lint, format, boundaries and tests"
