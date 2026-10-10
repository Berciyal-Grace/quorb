# Prepare Quorb 0.3.0 without publishing

Release preparation handoff. This branch bumps the version and updates the bilingual user notes; it
does not publish, tag or run the release workflow.

## Status

- **Status**: `local-prepared`.
- **Repository**: `github.com/egdev6/quorb` (private, `main`); branch `chore/release-0.3.0` from
  `7e57d07fad62c03af8e51213f4aac3521e8fea4e`.
- **Version**: `0.3.0` in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml` and the `quorb`
  entry in `src-tauri/Cargo.lock` (`src-tauri/tauri.conf.json` reads `../package.json`, unchanged).
- **Baseline stable (last published)**: `v0.1.3` at `98f3397cbaa42d69e6c5bc20473b7542516e8c5d`.
  **Existing draft (do not touch)**: `v0.2.0`, source `5db406b34916990b2bfa1d036155636e53d20adb`; its
  Windows run succeeded with installers built **before** PR #40, so it lacks the PR #40 UI/Claude
  changes. Neither the draft nor the `v0.2.0` files are modified here.
- **Functional candidate**: `main` at `7e57d07fad62c03af8e51213f4aac3521e8fea4e` (PR #40 merge,
  `feat/claude-mods`). Notes source: `docs/releases/v0.3.0.md` (ES then EN), cumulative from `v0.1.3`
  because `v0.2.0` was never published.
- **Pre-commit state**: files are prepared for `0.3.0`, but `7e57d07` still declares `0.2.0`; the
  delivery commit (bump + notes) is not a valid `source_sha` until merged, so there are no ready
  workflow inputs.

## Delivery

- **Authorized**: the parent commits, pushes and opens the preparation PR (approved issue, `Closes`
  reference).
- **Not authorized**: merge, tag, workflow dispatch or publication.

## Release workflow (current)

`.github/workflows/release.yml`, name **Release**, only `workflow_dispatch` from `main` with `version`
(stable SemVer) and `source_sha` (40 hex ancestor of `origin/main`). Preflight checks ancestry, coupled
manifest versions, notes, updater public key and tag collision. The `windows-latest` job builds with
**Node 22** while `actions/checkout` / `actions/setup-node` are pinned to **Node 24-runtime** SHAs, runs
`npm ci` (`package-manager-cache: false`) and creates a **draft** release; nothing publishes
automatically.

- Updater public key in `src-tauri/tauri.conf.json` is present, non-placeholder and validates in
  preflight.
- Signing secret **names** `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` were
  confirmed present via authorized GitHub metadata; names only, no values read, not a signature
  guarantee.
- No installation was approved or needed and no bootstrap was performed.

## Functional change (baseline → candidate)

- Multiple accounts across nine providers (#33/#34): own name, report and, for CLI providers, session
  folder (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `GEMINI_CLI_HOME`); secrets scoped per account.
- Session renewal (#40): `session_stamp` and `createSessionMonitor` poll every ~15 s; when there is
  previous usage data it is kept dimmed with a "Renew session" action, and a native alert fires only
  when the master alerts switch and native alerts are on.
- Codex `auth.json` resolution is shared by `fetch` and the session stamp (`~/.codex/auth.json`
  fallback when `CODEX_HOME` lacks it).
- Settings providers are clickable cards and the initial window is taller, fitted to the monitor.

## Requirement audit

| Requirement | Scope | State | Evidence / next action |
| --- | --- | --- | --- |
| Version manifests | Local | present | all four sources declare `0.3.0` on this branch |
| Bilingual notes | Local | present | `docs/releases/v0.3.0.md` |
| Release workflow | CI runner | present | manual `main` dispatch, draft release, `windows-latest`, Node 22 build with Node 24-runtime pinned actions |
| Updater public key | CI runner | present | non-placeholder minisign key validates in preflight |
| Signing secret names | CI runner | present (names only) | authorized GitHub metadata; not a signature guarantee |
| Windows E2E onboarding/login | Native Windows | not validated | credential store and CLI login (`GEMINI_CLI_HOME`) only read/wired and unit-tested |

## Preparation verification

| Check | Command/evidence | Result |
| --- | --- | --- |
| Whitespace / conflict markers | `git diff --check` | passed |
| Lock diff restricted to own version | `git diff src-tauri/Cargo.lock package-lock.json` | only `quorb` version lines change; no dependency churn |
| Frontend + script tests | `npm test` | 143 Vitest + 46 Node pass; `release-check.test.mjs` exercised standalone |
| Type check + build | `npm run build` | `tsc --noEmit` + `vite build` pass |
| Rust tests | `cargo test --offline --locked` (from `src-tauri/`) | 48 passed, 0 failed |
| Real preflight on candidate (read-only) | `RELEASE_VERSION=0.3.0 RELEASE_SOURCE_SHA=7e57d07fad62c03af8e51213f4aac3521e8fea4e node scripts/release-check.mjs` | rejected **as expected**: `7e57d07` declares `0.2.0` in all four manifests and has no `docs/releases/v0.3.0.md`. Not a preparation failure; the expected gate until the version commit merges. |

- The preflight failure is the real observed output, not a fabricated SHA or stub. The final preflight
  can only pass once the merged preparation commit is the `source_sha`. Local env: `node_modules` is a
  symlink already present; `cargo test` runs offline with `--locked` against a local cargo cache, with
  `PATH` extended locally and a reused target directory. Nothing was installed or upgraded, and no
  personal paths are recorded here.

## Remaining checks

- Windows E2E onboarding, Credential Manager and CLI login are pending; code reading and tests only,
  not a native Windows run. The occasional widget disappearance stays open and is not fixed here.
- Modal/side-panel keyboard focus and screen-reader announcements need review; no accessibility
  improvement is claimed.
- Authenticode is absent; only the updater update is minisign-signed, which does not vouch for the
  publisher. No SmartScreen promise; do not disable protections. The anonymous updater feed is private
  and inaccessible (known 404); no automatic updates are promised. The repository is private; never
  embed a token or personal key.

## Manual next step

There is no executable handoff yet. Do not dispatch the workflow.

1. Deliver the authorized preparation PR and let the owner merge it.
2. Re-read the merged `origin/main` SHA and confirm it declares `0.3.0` everywhere and
   `docs/releases/v0.3.0.md` exists at that SHA.
3. Only then run the manual workflow with `version=0.3.0` and that verified `source_sha`.

No workflow was dispatched, no tag created and no release published by this preparation.
