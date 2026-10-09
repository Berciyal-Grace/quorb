# Prepare Quorb 0.1.1 without publishing

Review the release infrastructure in a feature-branch chain. Keep the integration tracker in draft: merging preparation must never run or publish a release.

## Review order

| Unit | Review first | Outcome |
| --- | --- | --- |
| 1 · Version tooling | `scripts/bump.mjs` and its tests | Coupled versions and locks update consistently. |
| 2 · Preflight | `scripts/release-check.mjs` and its tests | Invalid sources, versions, notes, keys or existing tags stop the release. |
| 3 · Owner signing | `scripts/setup-signing.mjs` and its tests | Interactive setup targets the correct repository without exposing secrets. |
| 4 · Workflow and release | `.github/workflows/release.yml`, manifests and bilingual notes | A manual run creates a draft from the validated source commit. |

## Integration path

1. Review child PRs against their immediate parent, not against the whole stack.
2. Merge the first child into the integration branch. After each parent lands, retarget the next child to that integration branch before merging it.
3. Verify all units are present and tests/build pass on the integrated branch.
4. Only then mark the tracker ready and review its final diff against `main`.
5. After the tracker merges, verify the actual source SHA and manually run **Release** with version `0.1.1`.

No child, tracker merge, push or tag should automatically publish. No merge or workflow run is authorized by this document.

## Remaining checks

- Cryptographic signing and Windows packaging/installation must be checked by the manual build and human validation.
- The repository is private: authenticated downloads work for authorized accounts; the current unauthenticated updater endpoint is not a public update feed.
- The old taskbar icon symptom is not claimed fixed. Authenticode signing is not configured.
- Private keys and passwords stay outside Git; commit only the updater public configuration.

## Verification record

Use each PR's actual test evidence. The larger signing unit keeps its safety tests with the helper; do not trim coverage or compress code to satisfy a line-count target.
