set shell := ["bash", "-euo", "pipefail", "-c"]

default:
    @just --list

install:
    pnpm install

typecheck:
    pnpm -r --if-present run typecheck

lint:
    pnpm exec eslint .

format:
    pnpm exec prettier --write .

format-check:
    pnpm exec prettier --check .

test:
    pnpm -r --if-present run test

check: format-check lint typecheck test

build-vendor:
    pnpm --filter @exp/vendor run build

build-common:
    pnpm --filter @exp/common run build

build-shared: build-vendor build-common
    pnpm exec tsx scripts/vendor-hash.ts

pre-commit:
    #!/usr/bin/env bash
    set -euo pipefail
    if ! command -v gitleaks >/dev/null 2>&1; then
      echo "gitleaks is required but not installed. Install with: brew install gitleaks" >&2
      exit 1
    fi
    gitleaks protect --staged --redact --no-banner
    pnpm exec lint-staged

commit-msg file:
    pnpm exec commitlint --edit "{{file}}"

# Stub: will validate an experiment's `experiment.status` transition (e.g.
# wip -> live) before it reaches the deployed registry, once registry and
# experiment-status semantics exist.
pre-push:
    @true
