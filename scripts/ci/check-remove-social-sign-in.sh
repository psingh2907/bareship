#!/usr/bin/env bash
# Runs `pnpm remove-social-sign-in` on a scratch copy and checks the result, so the removal keeps working as
# the sign-in code changes (ADR 0020). Like check-strip-examples.sh, the copy shares node_modules through a
# symlink and calls the tools directly. Native folders are copied without build output, so the iOS project
# edits are checked too.
set -euo pipefail
cd "$(dirname "$0")/../.."
root="$PWD"
copy="$(mktemp -d)"
trap 'rm -f "$copy/node_modules"; rm -rf "$copy"' EXIT

rsync -a --exclude node_modules --exclude .git --exclude vendor --exclude coverage --exclude dist \
  --exclude website --exclude ios/Pods --exclude ios/build --exclude 'android/**/build' \
  --exclude android/.gradle --exclude android/.kotlin ./ "$copy/"
ln -s "$root/node_modules" "$copy/node_modules"
cd "$copy"
bin=node_modules/.bin

"$bin/tsx" scripts/remove-social-sign-in.ts --no-install

fail() { echo "✖ $1"; exit 1; }
if grep -rEn '(//|/\*|#|<!--)\s*@social' src scripts .env* AGENTS.md docs \
  --include='*.ts' --include='*.tsx' --include='*.rb' --include='*.md' --include='.env*' \
  | grep -v 'scripts/remove-social-sign-in.ts'; then
  fail 'Social sign-in markers left after removal'
fi
if grep -rEn "google-signin|apple-authentication|SocialSignIn|SocialButton|SignInSans|/auth/social" \
  src package.json; then
  fail 'References to social sign-in left after removal'
fi
app=$(node -p "require('./app.json').name")
if grep -En 'google-sign-in|GOOGLE_URL_SCHEME|SignInSans' "ios/$app/Info.plist" ios/Config/*.xcconfig \
  "ios/$app.xcodeproj/project.pbxproj"; then
  fail 'The iOS project still has the Google URL scheme or the font'
fi
if command -v plutil >/dev/null; then
  plutil -lint "ios/$app/Info.plist" "ios/$app.xcodeproj/project.pbxproj" >/dev/null
fi
# The JS checks don't need the native folders, and Jest would crawl them (like check-strip-examples.sh).
rm -rf ios android

"$bin/tsc" --noEmit
"$bin/eslint" . --max-warnings=0
"$bin/prettier" --check . --log-level warn
"$bin/depcruise" src --config .dependency-cruiser.cjs
# A fresh copy has a cold Jest cache, so the full-app tests compile everything on their first run.
"$bin/jest" --ci --testTimeout=20000

# Running it again changes nothing.
"$bin/tsx" scripts/remove-social-sign-in.ts --no-install | grep -q 'Nothing to remove' ||
  fail 'A second run tried to change something'
echo "✔ The app without social sign-in passes types, lint, format, boundaries and tests"
