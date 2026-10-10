# Codex installation — integration tracker

Tracks [issue #56](https://github.com/egdev6/quorb/issues/56). This branch is an integration target, not a shipped feature.

## Review order

1. Bounded subprocess runner and locked platform dependencies.
2. Consented installer, fresh CLI detection and backend registration.
3. Root-lived settings controller and installation UI with tests.
4. Bilingual onboarding/README installation text; remove this temporary tracker file.

Each child targets its immediate parent. Keep tests with their implementation; some cohesive units remain larger than the advisory 400-line budget. Do not shrink code by deleting tests or comments.

## Integration gate

- All child reviews and their applicable checks must complete.
- The repository owner will compile and validate real Windows behavior before integration.
- The combined source has prior Linux/independent/native review evidence, but partial snapshots do not automatically inherit that approval.
- This tracker stays draft/no-merge until the complete feature is integrated and validated.
- No automatic merge, release, Node installation, elevation or OAuth is authorized.

The final integrated tree must match the reviewed feature; this temporary document is removed by the documentation unit. The existing v0.4.0 draft does not contain this feature.
