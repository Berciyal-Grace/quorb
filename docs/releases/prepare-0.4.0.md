# Prepare Quorb 0.4.0 without publishing

## Status: `local-prepared`

This document records the preparation snapshot. Remote delivery and the final
merged source must be verified separately before the manual workflow is ready.

- Repository: `github.com/egdev6/quorb`; branch `chore/release-0.4.0`.
- Selected version: **0.4.0**; bilingual ES/EN notes in `docs/releases/v0.4.0.md`.
- Previous published stable: **v0.3.1**, commit
  `10ce3cebd998215f1d49e91d5d3bc25df7dc75ad`.
- Functional/documentation candidate: `main` at
  `95bdd0f39012d8edb302f096ab49944bcdbbec9c`, after merged PR #51 and #53.
  These are the changes since the baseline; no unmerged work is included.
- Existing `npm run bump 0.4.0` synchronizes `package.json`, `package-lock.json`,
  `src-tauri/Cargo.toml` and the application's `Cargo.lock` entry.
- `tauri.conf.json` still reads `../package.json`. Dependencies, scripts and
  signing configuration are unchanged.
- The draft `docs/releases/next.md` is moved to `v0.4.0.md`, versioned and linked
  to the implemented feature and documentation PRs.
- The functional candidate still declares **0.3.1**. There is no final
  `source_sha` until this preparation is delivered and merged.

## Scope and authority

The owner requested preparation of 0.4.0 after the connection-flow and bilingual
documentation merges. Preparation is isolated; the original checkout is preserved.
Issue creation, protected approval labels, commit, push and a preparation PR need a
separate delivery grant. No merge, dispatch, tags, publication, installation,
secret changes or privileged configuration are authorized by preparation.

Notes describe individual connection checks, CLI notices, saved versus draft
configuration and inherited account settings. Multiple accounts themselves are not
new in this release. File presence is not valid authentication, and custom folders
are not an isolation guarantee. No new runtime fixes or dependencies are added here.

## Prerequisite audit

| Requirement | Scope | Evidence / state |
| --- | --- | --- |
| Versions and locks | Local | Five version fields across four files are 0.4.0; exact app-only delta, no dependency changes. |
| Notes source | Local/runner | Versioned `docs/releases/v0.4.0.md`, ES then EN; the unversioned draft is removed by the move. |
| Node and dependencies | Local | Node 24.20.0 / npm 12.0.2; existing dependency tree reused, no installation. |
| Rust and cache | Local | Rust/Cargo 1.99.0; offline/locked test target reused. |
| Windows build tools | Runner | Existing `windows-latest`, Node 22 and Rust stable workflow; not a local Windows runtime validation. |
| Workflow | Remote main | **Release**, `.github/workflows/release.yml`, manual `workflow_dispatch` only; inputs `version` and `source_sha`. |
| Public updater configuration | Source/runner | Existing non-placeholder minisign public key passes the repository's format validator; no key change. |
| Signing secret names | Remote metadata | `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` present; values never read. |
| Collision | Remote | No release or tag v0.4.0 found during preparation; recheck before manual execution. |
| Platform signing / updater access | Windows/service | Authenticode and anonymous private-feed access not established; separate from updater signing. |

Compatible infrastructure is reused. No bootstrap installation or configuration was
needed or performed. Secret metadata and previous successful releases do not prove
future build, signing, installer or runtime success.

## Preparation checks

| Check | Observed result |
| --- | --- |
| Version consistency and Tauri authority | Passed: five fields 0.4.0; Tauri reads package.json. |
| Dependency/lock scope | Passed: restoring only the app version reproduces baseline manifests and locks. |
| Existing release-script tests | 46 passed; bump, preflight and signing-setup safety tests. |
| Frontend tests and build | 168 Vitest + 46 Node passed; typecheck and Vite passed, 84 modules. |
| Rust offline/locked tests | 60 passed; quorb v0.4.0 compiled with dependency cache, not a clean rebuild. |
| Independent verification | No concrete source/version/notes defects; suite and build repeated on this preparation tree. |
| Real preflight on functional SHA | Expected rejection: four manifest-version errors and missing v0.4.0 notes, no other reported gate errors. |

Lock verification targets the `quorb` entry, not a dependency that happens to use
the same version. No new application logic was written: existing script tests and
exact version-delta checks apply; no new behavioral RED case is claimed.

**274 tests pass** on this preparation tree. Native ASSESS was unassessable while
notes were untracked; its conservative independent-verifier plan was followed.
No native review approval is claimed. Tests/build are not Windows runtime or
signature validation.

The real command was `RELEASE_VERSION=0.4.0
RELEASE_SOURCE_SHA=95bdd0f39012d8edb302f096ab49944bcdbbec9c node scripts/release-check.mjs`.
It reads committed files with `git show`, not local changes. Exit 1 is required
because that source still contains 0.3.1 and lacks versioned notes. It is not an
approval of any future merged source.

## Manual workflow — not ready to run yet

After authorized preparation delivery and owner merge, refresh and verify the
exact merged SHA on `origin/main`; recheck tag/release collisions and run the real
read-only preflight for **0.4.0** against that source. Do not invent a SHA, retarget
`origin/main` or create a tag to bypass the gate.

Only after those checks provide the executable handoff: Actions → **Release**,
ref `main`, inputs `version=0.4.0` and `source_sha=<verified merged SHA>`.
No executable source SHA is supplied here.

The workflow checks out the validated source, runs tests/build on Windows and
creates EXE/MSI installers, updater artifacts and a **draft** release for owner
review. It does not publish automatically. Future signing and artifact verification
remain pending until the workflow runs; the updater signature is not Authenticode.

## Remaining checks

- Authorized preparation issue/PR delivery and owner merge.
- Final source validation and manual workflow handoff.
- Windows connection steps, CLI login, credential isolation, Credential Manager,
  DOM/accessibility and future installer/signature checks.
- Occasional disappearing widget remains unresolved; no automatic-update,
  Authenticode or SmartScreen promise.

No workflow was dispatched, no release tag created and no release published.
