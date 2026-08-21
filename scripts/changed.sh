#!/usr/bin/env bash
# Prints changed app slugs, one per line: every apps/<slug> touched between
# --base (defaulting to HEAD^) and HEAD, plus any app on disk that's absent
# from the currently deployed registry (covers a brand-new app and recovery
# from a run that built an app but never got its registry entry merged).
#
# --base should be the last commit actually deployed (e.g. site-state's
# recorded deployedSha), not always HEAD^ — a workflow_dispatch run that
# doesn't correspond to a fresh push would otherwise keep re-diffing the
# same last commit on every manual re-run, forever re-rebuilding whatever
# it touched even when site-state has already moved on (e.g. after a
# rollback that reset site-state without a new commit on main).
#
# Usage: scripts/changed.sh [--registry <path-to-deployed-registry.json>] [--base <sha>]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGISTRY=""
BASE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --registry)
      REGISTRY="$2"
      shift 2
      ;;
    --base)
      BASE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$BASE" ]] && git rev-parse HEAD^ >/dev/null 2>&1; then
  BASE="HEAD^"
fi

slugs=()

if [[ -n "$BASE" ]] && git -C "$ROOT" rev-parse "$BASE" >/dev/null 2>&1; then
  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    slug="${path#apps/}"
    slug="${slug%%/*}"
    slugs+=("$slug")
  done < <(git -C "$ROOT" diff --name-only "$BASE" HEAD -- 'apps/**')
fi

if [[ -d "$ROOT/apps" ]]; then
  for dir in "$ROOT"/apps/*/; do
    [[ -d "$dir" ]] || continue
    slug="$(basename "$dir")"
    [[ -f "$dir/package.json" ]] || continue

    if [[ -n "$REGISTRY" && -f "$REGISTRY" ]]; then
      if ! node -e "
        const fs = require('node:fs');
        const registry = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
        const slugs = Array.isArray(registry) ? registry.map((e) => e.slug) : [];
        process.exit(slugs.includes(process.argv[2]) ? 0 : 1);
      " "$REGISTRY" "$slug"; then
        slugs+=("$slug")
      fi
    fi
  done
fi

printf '%s\n' "${slugs[@]+"${slugs[@]}"}" | awk 'NF' | sort -u
