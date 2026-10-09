# Prepare Quorb 0.1.3 without publishing

Release preparation only. This branch raises coupled metadata and bilingual
notes. The user authorized a preparation commit and branch push; opening a PR,
merging, tagging, dispatching or publishing remain unauthorized.

## Status

- **Status**: `local-prepared`.
- **Repository**: `github.com/egdev6/quorb` (private, default branch `main`).
- **Version**: `0.1.3`.
- **Previous stable**: `v0.1.2` at
  `14b29a42ed3714b357152185f9d9490927ca826a` (published release
  `407857271`).
- **Functional candidate SHA**:
  `3d002eca4801265e77bad92204cbd1f60b448030` (merge of PR #26 and verified
  `origin/main` at preparation time). This is the functional baseline, **not**
  the preparation commit or final release `source_sha`.
- **Preparation PR**: not authorized / not created.
- **Notes source**: `docs/releases/v0.1.3.md` (Spanish then English).
- **No eligible release source SHA on main yet**: the release source must be a
  commit already on `origin/main` that declares `0.1.3` everywhere. Baseline
  `3d002ec` still declares `0.1.2`; committing and pushing this preparation
  branch is not sufficient. Merge and revalidate the final SHA before supplying
  executable workflow inputs.

## What this branch changes

- Coupled versions in `package.json`, `package-lock.json`,
  `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock` via `npm run bump 0.1.3`.
  The diff is only version bytes.
- `docs/releases/v0.1.3.md`: short bilingual ES/EN notes.
- `docs/releases/prepare-0.1.3.md`: this handoff.

No source, workflow, signing or `tauri.conf.json` changes:
`src-tauri/tauri.conf.json` keeps `"version": "../package.json"`, so it is not a
version authority here and needs no edit.

## Prerequisite audit and bootstrap

| Requirement | Scope | Before → after | Evidence / next action |
| --- | --- | --- | --- |
| Node 24.20.0 / npm 12.0.2 | Local prep host | present | `node -v`, `npm -v` |
| Rust / cargo 1.99.0 | Local prep host | present | `cargo --version` (via `$HOME/.cargo/bin`) |
| Frontend deps | Local prep host | present (reused, no install) | ignored `node_modules` symlink to the existing tree; lock equivalent ignoring root version |
| Release workflow | CI runner | present, active | `.github/workflows/release.yml`, manual `workflow_dispatch` on `main`, creates a draft |
| Signing secret names | CI runner | present (names only) | `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` confirmed present by parent via authorized `gh secret list` this session; values were never read. Metadata evidence is not a signature guarantee. |
| Windows/MSVC validation | CI runner | not applicable locally | native Windows checks are pending |

- **Approved plan**: no installations authorized. Dependency reuse only: an
  ignored `node_modules` symlink to the existing installed tree, after verifying
  `package-lock.json` equivalence ignoring the root version. No `npm ci`/install.
- **Applied changes**: created the ignored `node_modules` symlink; ran
  `npm run bump 0.1.3`. No package writes.
- **Pending approvals/setup**: none required for local preparation. Metadata
  reads and the preparation commit/push were authorized. Opening a PR, merging
  and workflow execution remain outside the granted scope.

## Preparation verification

| Check | Command/evidence | Result |
| --- | --- | --- |
| Version consistency and locks | `npm run bump 0.1.3`; diff touches only version bytes in the four manifests | passed |
| Frontend/script tests | `npm test` | passed (vitest 15 files / 124 tests; node 46 pass, 0 fail) |
| Frontend build | `npm run build` | passed — runs `tsc --noEmit` then vite build; no separate `npm run typecheck` was run |
| Rust tests | `cargo test --locked --offline` | passed (37 passed, 0 failed) |
| Preflight (immutable source) | `RELEASE_VERSION=0.1.2 RELEASE_SOURCE_SHA=3d002ec… node scripts/release-check.mjs` | passed (source `3d002ec` is a `0.1.2` manifest) |
| Preflight (`0.1.3`) | `RELEASE_VERSION=0.1.3 RELEASE_SOURCE_SHA=3d002ec… node scripts/release-check.mjs` | expected **fail** (source still declares `0.1.2`, notes absent at that SHA) |
| Delivery scope | explicit user authorization | preparation commit and branch push only; no PR or merge |

## Release range (baseline → candidate)

- Baseline `v0.1.2` → candidate `3d002ec`: PR #26 (`fix/autostart-save`).
- User-visible: "Start with Windows" now applies through Settings' manual
  "Save changes" / «Guardar cambios» (#19), with visible errors and retry,
  partial-save messaging, no false combined "Saved ✓", in-flight edit
  preservation and lifecycle guards. Saving is not atomic.
- **Not fixed / not claimed**: the occasional widget disappearance remains
  under investigation and is not corrected in this version.

## Remaining checks

- Windows visual, updater and installer validation are pending; do not claim
  tested on Windows. Autostart (#19) has no native Windows validation.
- Authenticode is absent; only the updater update is minisign-signed, which does
  not vouch for the publisher. No SmartScreen promise and no advice to disable
  protections.
- The anonymous updater feed is private and inaccessible (known 404); while it
  stays that way, automatic updates will not work. It needs a public repository
  or an accessible update feed. No automatic updates are promised.
- Signing secret names were confirmed present by parent metadata evidence
  (authorized `gh secret list`); only names, never values. The updater public key
  in `src-tauri/tauri.conf.json` is unchanged and the `0.1.2` source preflight
  validates it, but that is metadata validation, not a native Windows proof.
- The occasional widget disappearance stays open and is not resolved by this
  release.

## Manual next step (blockers before any run)

There is no executable handoff yet. Do not dispatch the workflow.

1. After the authorized commit/push, separately authorize opening the
   preparation PR and its eventual merge.
2. Re-read the merged `origin/main` SHA and confirm it declares `0.1.3`
   everywhere and `docs/releases/v0.1.3.md` exists at that SHA.
3. Only then run the manual workflow with `version=0.1.3` and that verified
   `source_sha`.

No workflow was dispatched, release tag created, or release published by this
preparation.
