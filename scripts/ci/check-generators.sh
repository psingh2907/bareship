#!/usr/bin/env bash
# Runs every `pnpm gen` command on a scratch copy and checks the result, so the generators keep producing
# code that passes the project's rules as those rules change (docs/generators.md). Like
# check-strip-examples.sh, the copy shares node_modules through a symlink and calls the tools directly.
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

"$bin/tsx" scripts/generate.ts feature orders
"$bin/tsx" scripts/generate.ts feature people --item person
"$bin/tsx" scripts/generate.ts screen orders order-detail --param id
"$bin/tsx" scripts/generate.ts endpoint orders cancel-order --method post --path /orders/:id/cancel

"$bin/tsc" --noEmit
"$bin/eslint" . --max-warnings=0
"$bin/prettier" --check . --log-level warn
"$bin/depcruise" src --config .dependency-cruiser.cjs
# A fresh copy has a cold Jest cache, so the full-app tests compile everything on their first run.
"$bin/jest" --ci --testTimeout=20000
echo "✔ Generated features, screens and endpoints pass types, lint, format, boundaries and tests"
