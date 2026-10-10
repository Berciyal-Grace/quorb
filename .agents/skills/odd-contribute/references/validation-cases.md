# Contract readback cases

These cases specify expected assistant behavior, not automated GitHub enforcement.
Structural checks do not prove that every assistant or contributor follows the contract.

| Case | Expected behavior |
| --- | --- |
| No approved index or ODD signal | Ask for planning, or use the non-ODD contribution path; no fabricated priority. |
| New issue/PR has another assignee | Exclude from free work; warn and offer alternatives. |
| Assigned only to the contributor | Offer resume separately; do not add a duplicate assignee. |
| Unassigned issue already covered by a draft/fork PR | Detect active work and coordinate; no duplicate implementation. |
| Browse, plan, study or review a PR | Do not assign or begin implementation. |
| Explicit start, free and eligible | Verify login and state, add assignee, re-read, then proceed. |
| Shared credential, bot or ambiguous identity | Ask; do not assign to repository owner by default. |
| Permission error or timeout | Reconcile by reading; do not claim reservation or retry blindly. |
| Another assignee/PR appears during claim | Pause and coordinate; never remove others. |
| Independent lower-priority issue | Warn and allow choice. |
| Scope or dependencies change before PR | Revalidate and seek accepted revision as needed. |
| Tests fail or PR is still open | Report pending work; do not declare integrated. |
| Authorized PR is opened | Assign and verify PR and linked issue; do not auto-merge. |
