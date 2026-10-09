# Prepare Quorb 0.1.2 without publishing

Release preparation only. This branch raises metadata and bilingual notes; it
does not publish, tag or run the release workflow.

## Status

- **Candidate baseline**: full SHA
  `149d0c3d8286ae85fd7a7be66df54a14c3d0dcd9` (`chore/release-0.1.2`), equal to
  `origin/main`.
- **Last stable**: `v0.1.1` at `334a6629e574d5e7552cb4f6c93c500e0e9f02b7`.
- **State**: awaiting owner merge of the preparation PR; issue #24 is approved.
  Commit/push/PR are authorized. It is not ready for a manual release run.
- **No valid source SHA yet**: the release source must be a commit already on
  `origin/main` that declares `0.1.2` everywhere. The candidate baseline still
  declares `0.1.1`, so there is no reusable exact source for `0.1.2` until this
  preparation is committed and merged. Do not supply executable workflow inputs
  before that.

## What this branch changes

- Coupled versions in `package.json`, `package-lock.json`,
  `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock` via `npm run bump 0.1.2`.
- `docs/releases/v0.1.2.md`: short bilingual ES/EN notes.
- `docs/releases/prepare-0.1.2.md`: this handoff.

No source code, workflow or signing configuration changes.

## Release workflow (current)

`.github/workflows/release.yml`, name **Release**, only `workflow_dispatch` from
`main`, inputs `version` (stable SemVer) and `source_sha` (40 hex). Preflight
checks source ancestry, coupled versions, bilingual notes, updater public key
and tag collision, then the job builds and creates a **draft** release. Nothing
publishes automatically.

## Before the manual run

1. Issue #24 is approved and delivery is authorized; submit the preparation PR
   with `Closes #24`. Owner merge is a separate action, not authorized here.
2. After the merge, the source SHA must be re-read from `origin/main` and
   readiness confirmed before anyone clicks **Run workflow** with `0.1.2`.
3. Secret-name presence (`TAURI_SIGNING_PRIVATE_KEY`) was not freshly verified
   here (no metadata authorization); the public updater key can be validated
   locally, but that is not signature proof.
4. CI reuses the Windows dependencies already automated in the workflow; there
   are no local native Windows checks.

## Remaining checks

- Windows visual, updater and installation validation are pending; do not claim
  tested on Windows.
- Authenticode is absent; only the updater update is minisign-signed, which does
  not vouch for the publisher. No SmartScreen promise and no advice to disable
  protections. Code signing is evaluated in #20; SignPath is not guaranteed or
  accepted.
- Private-repo access must be revisited before any public announcement; the
  updater endpoint is not verified as public.
- Applying "Start with Windows" / «Arrancar con Windows» through Settings'
  manual "Save changes" / «Guardar cambios» remains pending (#19), out of scope.
  Widget startup recovery and Settings save protection both already came from
  0.1.1.
