---
description: Manually open/update the release PR (version bump + changelog) from conventional commits
---

Author the release PR locally — the same outcome as the automated
`release-agent.yml`, for when you want to drive it by hand.

Read `RELEASING.md` and follow the **"Release procedure (single source of
truth)"** section exactly — it is authoritative for deciding the semver bump and
authoring the PR. This opens/updates a PR; per that section, never run
`npm publish`, never create a tag, and never push to `main`.
