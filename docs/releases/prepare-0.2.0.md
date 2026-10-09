# Prepare Quorb 0.2.0 without publishing

Release preparation handoff. This branch bumps the version and updates the
bilingual user notes; it does not publish, tag or run the release workflow.

## Status

- **Status**: `local-prepared`.
- **Repository**: `github.com/egdev6/quorb` (private, `main`); branch
  `chore/release-0.2.0` from `310dbfc944cc986a8d7e439bf23178607168afb9`.
- **Version**: `0.2.0` in `package.json`, `package-lock.json`,
  `src-tauri/Cargo.toml` and the `quorb` entry in `src-tauri/Cargo.lock`.
- **Baseline stable**: `v0.1.3` at `98f3397cbaa42d69e6c5bc20473b7542516e8c5d`.
- **Functional candidate**: `main` `310dbfc944cc986a8d7e439bf23178607168afb9`
  (PR #34 merge, `feat/multi-account`). Range: `ff48a84` + `ffde829` + merge;
  issue #33 closed. **Notes source**: `docs/releases/v0.2.0.md` (ES then EN).
- **Pre-commit state**: the files are prepared for `0.2.0`, but the functional
  candidate `310dbfc` still declares `0.1.3`. The delivery commit will include
  the version bump and notes; it is not a valid `source_sha` until merged. Do not
  supply `version`/`source_sha` from this branch.

## Delivery

- **Authorized**: commit, push and open the preparation PR for this branch.
- **Not authorized**: merge, tag, workflow dispatch or publication. Those stay
  the owner's separate steps after review.

## Release workflow (current)

`.github/workflows/release.yml`, name **Release**. Only `workflow_dispatch`
from `main`, inputs `version` (stable SemVer) and `source_sha` (40 hex, ancestor
of `origin/main`). Preflight checks ancestry, coupled manifest versions, notes,
updater public key and tag collision. The Windows job (`windows-latest`,
Node 22) builds and creates a **draft** release (`releaseDraft: true`); nothing
publishes automatically.

- Updater public key in `src-tauri/tauri.conf.json` is present and non-placeholder.
- Signing secret **names** `TAURI_SIGNING_PRIVATE_KEY` and
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` were confirmed present via authorized
  GitHub metadata. Names alone do not prove a future signature will succeed; no
  secret values or private keys were read or embedded.

## Functional change (baseline → candidate)

- Multiple accounts per provider across nine providers (Claude, ChatGPT/Codex,
  Gemini, Cursor, GitHub Copilot, NaN Builders, OpenRouter, Anthropic API,
  OpenAI API). Each has its own name, report and, for CLI providers, session
  folder (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `GEMINI_CLI_HOME`).
- Three regressions fixed: widget saves preserve accounts (patch merge never
  touches accounts/secrets), secrets re-read after a confirmed save (no false
  "not connected"), and "Official usage" resolves scoped account ids.

## Requirement audit

| Requirement | Scope | State | Evidence / next action |
| --- | --- | --- | --- |
| Version manifests | Local | present | all four sources declare `0.2.0` on this branch |
| Bilingual notes | Local | present | `docs/releases/v0.2.0.md` |
| Release workflow | CI runner | present | manual `main` dispatch, draft release, Node 22 / `windows-latest` |
| Updater public key | CI runner | present | non-placeholder minisign key validates in preflight |
| Signing secret names | CI runner | present (names only) | authorized GitHub metadata; not a signature guarantee |
| Windows E2E onboarding/login | Native Windows | not validated | credential store and CLI login (`GEMINI_CLI_HOME`) only read/wired and unit-tested |

## Preparation verification

| Check | Command/evidence | Result |
| --- | --- | --- |
| Whitespace / conflict markers | `git diff --check` | passed |
| Lock diff restricted to own version | `git diff src-tauri/Cargo.lock package-lock.json` | only `quorb` version lines change; no incidental dependency churn |
| Frontend + release-script tests | `npm test` | 131 Vitest + 46 Node pass; `release-check.test.mjs` exercised |
| Type check + build | `npm run build` | `tsc --noEmit` + `vite build` pass |
| Rust tests | `cargo test --offline --locked` (from `src-tauri/`) | 43 passed, 0 failed |
| Real preflight on functional candidate (read-only, run by verifier) | `RELEASE_VERSION=0.2.0 RELEASE_SOURCE_SHA=310dbfc944cc986a8d7e439bf23178607168afb9 node scripts/release-check.mjs` | rejected as expected: `310dbfc` still declares `0.1.3` and has no `docs/releases/v0.2.0.md`. Not a preparation failure; the expected gate until the version commit merges. |

- The real preflight was never declared passing; the rejection above is the
  verifier's observed output. `git diff --check` and the tests are read-only and
  reproducible.
- Local env: Node 24 / npm 12 / Cargo 1.99; `cargo test` runs offline with
  `--locked` against a locally configured cargo cache, with `PATH` set locally;
  `node_modules` is a symlink already present. Nothing was installed or upgraded.

## Remaining checks

- Windows E2E onboarding, Credential Manager and CLI login are pending; this
  version claims code reading and tests only, not a native Windows run.
- The occasional widget disappearance stays open and is not fixed here.
- Keyboard focus in modals/side panels and screen-reader announcements still
  need review; accessibility is not claimed as improved.
- Authenticode is absent; only the updater update is minisign-signed, which does
  not vouch for the publisher. No SmartScreen promise; do not disable protections.
- The anonymous updater feed is private and inaccessible (known 404); no
  automatic updates are promised. The repository is private; never embed a token
  or personal key.

## Manual next step

There is no executable handoff yet. Do not dispatch the workflow.

1. Deliver the authorized preparation PR and let the owner merge it.
2. Re-read the merged `origin/main` SHA and confirm it declares `0.2.0`
   everywhere and `docs/releases/v0.2.0.md` exists at that SHA.
3. Only then run the manual workflow with `version=0.2.0` and that verified
   `source_sha`.

No workflow was dispatched, no tag created and no release published by this
preparation.
