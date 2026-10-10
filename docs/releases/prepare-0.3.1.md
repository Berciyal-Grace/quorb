# Prepare Quorb 0.3.1 without publishing

## Status: `local-prepared`

- Repository: `github.com/egdev6/quorb`; branch `chore/release-0.3.1`.
- Confirmed version: **0.3.1**, bilingual ES/EN notes in `docs/releases/v0.3.1.md`.
- Last published stable: `v0.3.0`, `bb73afbd58fa72a19556360f57aecbfe720e1f3c`.
  `0.2.0` and `0.3.0` are now published; neither is modified here.
- Functional candidate: `main` at `5d06d7e5dd397fd5983ae4782826923c32931bd6`, merge of
  PR #47. Only its onboarding changes enter the release range. Open PR #44 is excluded.
- Four version sources are bumped through `npm run bump 0.3.1`: `package.json`,
  `package-lock.json`, `src-tauri/Cargo.toml` and the `quorb` entry in `Cargo.lock`.
  `tauri.conf.json` still reads `../package.json`.
- The functional candidate still declares **0.3.0**. A final `source_sha` cannot be
  supplied until the preparation commit is delivered and merged into `main`.

## Scope and authorization

This preparation improves onboarding for existing additional CLI accounts and
preserves save errors instead of opening login prematurely. Presence of a credential
file is not valid authentication. Existing default folder separation is not a guarantee
for custom paths.

Local main was updated by fast-forward without switching or modifying the original
checkout. An isolated worktree holds the preparation. No installation, dependency
upgrade, infrastructure replacement or secret change is approved or needed.
The owner authorized issue #48 with `status:approved`, commit, push and a preparation
PR using `Closes #48`. Its merge remains the owner's decision. This document records
the verified pre-commit preparation; delivery state is checked separately after opening
the PR. Merge, workflow dispatch, tags and publication are not authorized.

## Prerequisite audit

| Requirement | Scope | Evidence / state |
| --- | --- | --- |
| Versions and locks | Local | existing bump script; four coupled sources; no dependency upgrades |
| Notes source | Local/CI | `docs/releases/v0.3.1.md`, ES then EN |
| Node/dependencies | Local | Node 24.20.0 and npm 12.0.2; existing dependency tree reused, no installation |
| Rust/cache | Local | Rust 1.99.0; offline locked tests reuse an existing target/cache |
| Windows tools | CI | existing `windows-latest` workflow builds on Node 22 with Rust/MSVC; not a local Windows validation |
| Release workflow | Remote main | **Release**, `.github/workflows/release.yml`, manual `workflow_dispatch` only |
| Signing public configuration | CI | existing non-placeholder updater key; final preflight validates it from the merged source |
| Signing secret names | Remote metadata | `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` present; values never read |
| Authenticode / anonymous updater access | Platform/service | not established; updater signing is distinct, private feed has known anonymous-access limitations |

Existing compatible automation is reused. No bootstrap changes were applied. Secret
metadata and previous successful workflow runs do not prove future signing or runtime success.

## Checks

| Check | Observed result |
| --- | --- |
| Coupled versions / Tauri authority | all five version fields are `0.3.1`; Tauri reads `../package.json` |
| Lock diffs | only the application's version changes; no dependency delta |
| Release script tests | 46 passed, including bump, preflight and signing-setup safety |
| `npm test` | 154 Vitest + 46 Node passed |
| `npm run build` | TypeScript and Vite passed |
| `cargo test --offline --locked` in `src-tauri` | 51 passed; offline cache/target reused |
| Whitespace / file scope | `git diff --check` passed; four manifests and two new Markdown files only |
| Independent verification | no in-scope defects; suite/build repeated on this preparation tree |
| Real preflight on functional SHA | rejected as expected: that commit still declares 0.3.0 and lacks 0.3.1 notes |

**251 tests pass** on this version-preparation tree. No new runtime logic or tooling
was introduced, so no new behavioral RED case applies: existing script tests and
version/lock assertions verify the bump. The final read-only preflight command was
`RELEASE_VERSION=0.3.1 RELEASE_SOURCE_SHA=5d06d7e5dd397fd5983ae4782826923c32931bd6 node scripts/release-check.mjs`.
It returned exit 1 with only the expected version/notes errors, not a signing or
ancestry approval for a future source.

Native ASSESS could not assess the untracked notes before authorized delivery/staging.
Its conservative independent-verifier plan was followed. No native approval is claimed;
these functional checks are not a Windows installer or runtime validation.

## Manual workflow — not ready to run yet

The existing workflow accepts `version` and `source_sha`, runs only from `main`,
validates the selected commit's ancestry, versions, notes, updater key and tag collision,
then checks out that exact source. It builds Windows installers and updater artifacts
and creates a **draft** release for owner review, not an automatically published release.

The real preflight reads files from the source commit via `git show`, not the working
tree. Using `version=0.3.1` with the functional SHA `5d06d7e…` must be rejected because
that commit declares 0.3.0 and lacks these notes. Do not substitute a fabricated SHA,
retarget `origin/main` or create a release tag to make this gate pass.

After authorized preparation delivery and owner merge, refresh `origin/main`, verify
its exact merged SHA and run the read-only preflight with that SHA. Only then provide
the final manual inputs: `version=0.3.1`, `source_sha=<verified merged preparation SHA>`.
No executable workflow handoff exists yet.

## Remaining validation

- Windows onboarding, CLI login, Credential Manager and real account isolation.
- DOM/visual/accessibility checks; occasional widget disappearance remains unresolved.
- Future Windows installer build and signatures; no automatic-update or SmartScreen promise.

No workflow was dispatched, no release tag created and no release published.
