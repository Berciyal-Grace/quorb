# Prepare Quorb 0.1.3 without publishing

Release preparation handoff. This branch updates the bilingual user notes and
this handoff only; it does not publish, tag or run the release workflow.

## Status

- **Status**: `awaiting-merge`.
- **Repository**: `github.com/egdev6/quorb` (private, default branch `main`).
- **Version**: `0.1.3`; `package.json`, `package-lock.json`,
  `src-tauri/Cargo.toml` and the `quorb` entry in `src-tauri/Cargo.lock`
  already declare `0.1.3` on the functional candidate.
- **Previous stable**: `v0.1.2` at
  `14b29a42ed3714b357152185f9d9490927ca826a` (published release and tag verified
  through GitHub). The tag was not fetched locally; its absence in this checkout
  does not change the verified baseline.
- **Functional candidate**: `main` at
  `bde9a86e14f9ca6975e0aaea34d40136050410b8` (merge of PR #30, "redesign v2").
  It includes the #19 fix (PR #26) and the redesign (PR #30); the release
  metadata came from the earlier preparation PR #28, merged at `2d610aa`.
- **This docs follow-up**: tracked in issue #31. The PR records the preparation
  commit; the final merged source SHA must be verified after its merge.
- **Notes source**: `docs/releases/v0.1.3.md` (Spanish then English). This is
  the "corrected notes" content: the redesign facts and the truthful
  keyboard/screen-reader limitation are folded in.
- **No executable workflow inputs yet**: the functional candidate `bde9a86`
  passes the current preflight, but once these notes merge the source SHA will
  be the new post-merge `main` commit. Revalidate that final SHA before
  supplying `version`/`source_sha`.

## Delivery

- This docs change is approved in issue #31 (`type:docs`, `status:approved`).
  Commit, push and a PR with `Closes #31` are authorized. The issue closes only
  when that PR is merged; no merge, tag, dispatch or publication is authorized
  by this preparation.

## Release workflow (current)

`.github/workflows/release.yml`, name **Release**, workflow id `379142225`.
Only `workflow_dispatch` from `main`, with inputs `version` (stable SemVer) and
`source_sha` (40 hex, ancestor of `origin/main`). Preflight checks ancestry,
coupled manifest versions, the bilingual notes file, updater public key and tag
collision; the Windows job then builds and creates a **draft** release. Nothing
publishes automatically and no dispatch was performed.

- Signing secret **names** `TAURI_SIGNING_PRIVATE_KEY` and
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` were confirmed present through authorized
  GitHub metadata during this preparation session; values were never read.
  Name presence does not prove that a future signature will succeed.
- The updater public key in `src-tauri/tauri.conf.json` is present and validates
  in the existing preflight on `bde9a86`. No private keys or secret values were
  read.

## Prerequisite audit and bootstrap

| Requirement | Scope | Before → after | Evidence / next action |
| --- | --- | --- | --- |
| Version manifests | Local | present | all four manifests declare `0.1.3` on `bde9a86` |
| Release workflow | CI runner | present, active | `.github/workflows/release.yml`, id `379142225`, manual dispatch, draft outcome |
| Signing secret names | CI runner | present (names only) | authorized GitHub metadata during preparation; values never read; not a signature guarantee |
| Windows/MSVC validation | CI runner | not applicable locally | native Windows build/sign/installer pending |

- **Approved plan**: docs-only change; no installations, no dependency or source
  changes, no version/`tauri.conf.json` edits.
- **Applied changes**: updated `docs/releases/v0.1.3.md` and this handoff.
- **Pending actions**: deliver the authorized PR, then obtain owner review and
  merge. Workflow execution remains the owner's separate manual step.

## Preparation verification

| Check | Command/evidence | Result |
| --- | --- | --- |
| Whitespace / conflict markers | `git diff --check` | passed |
| Relative Markdown links | manual scan of `docs/releases/*.md` | no relative links; none broken |
| ES/EN symmetry | manual read of `docs/releases/v0.1.3.md` | matched sections ES/EN |
| Preflight (functional candidate) | `RELEASE_VERSION=0.1.3 RELEASE_SOURCE_SHA=bde9a86e… node scripts/release-check.mjs` | passed (validated for `bde9a86`) |
| App tests / typecheck / Rust | reviewed commit `712e763`, tree `e6b0296356ad772950a2a9fe5ad98f6ed045f5de`, identical to functional candidate `bde9a86` | 124 Vitest + 46 Node + 37 Rust pass, TypeScript/build pass; evidence reused, not re-run for docs |

App tests/build were **not** re-run: this change touches no application source.
The release assessment classifies it as passive: parent structural readback is
sufficient, with no separate verifier or application tests required.

## Release range (baseline → candidate)

- Baseline `v0.1.2` (`14b29a4`) → functional candidate `bde9a86`.
- User-visible: the #19 autostart manual-save behavior and the #30 settings
  redesign (Grafito module cards, foldable navigation, provider side panel, 85%
  initial zoom).

## Remaining checks

- Windows visual, updater and installer validation are pending; do not claim
  tested on Windows. Autostart (#19) has no native Windows validation.
- Keyboard focus in modals/side panels and screen-reader announcements still
  need review; accessibility is not claimed as improved.
- Authenticode is absent; only the updater update is minisign-signed, which does
  not vouch for the publisher. No SmartScreen promise and no advice to disable
  protections.
- The anonymous updater feed is private and inaccessible (known 404); automatic
  updates will not work until it is reachable. No automatic updates are
  promised.
- The occasional widget disappearance stays open and is not resolved by this
  release.

## Manual next step (blockers before any run)

There is no executable handoff yet. Do not dispatch the workflow.

1. Deliver the authorized docs PR (`Closes #31`); the owner reviews and merges
   it separately.
2. Re-read the merged `origin/main` SHA and confirm it declares `0.1.3`
   everywhere and `docs/releases/v0.1.3.md` exists at that SHA.
3. Only then run the manual workflow with `version=0.1.3` and that verified
   `source_sha`.

No workflow was dispatched, release tag created, or release published by this
preparation.
