---
description: Manually open/update the release PR (version bump + changelog) from conventional commits
---

Author the release PR locally — the same outcome as the automated
`release-agent.yml`, for when you want to drive it by hand. This opens a PR; it
must never publish or push to `main`.

1. `git fetch --tags --force`; find the latest tag with
   `git tag --sort=-v:refname | head -1` (LAST_TAG; if none, use full history).
2. Read the **full** commit messages since LAST_TAG (subjects AND bodies/footers):
   `git log LAST_TAG..HEAD --pretty=format:'%H%n%B%n---'`.
3. Decide the semver bump vs the current `package.json` version:
   - a `!` after the type (e.g. `feat!:`, `refactor!:`) **or** a
     `BREAKING CHANGE:` / `BREAKING-CHANGE:` footer → **major** (any type),
   - else any `feat` → **minor**,
   - else any `fix`/`perf` → **patch**.
   If nothing is releasable, stop.
4. `git checkout -B release/next`, then `npm version <newversion> --no-git-tag-version`.
5. Prepend a `## [<newversion>] - <YYYY-MM-DD>` section to `CHANGELOG.md`
   (Keep a Changelog style; group Added/Changed/Fixed/Security; concise human
   summaries, not raw commit lines). Update the compare links at the bottom.
6. If `README.md` has a hardcoded `freeagent-mcp-server@X.Y.Z`, update it.
7. Commit `chore: release <newversion>`, push `release/next`, and open/update the
   PR against `main` with `gh pr create` / `gh pr edit`.

Only modify: `package.json`, `package-lock.json`, `CHANGELOG.md`, README version.
Never run `npm publish`, never tag, never push to `main`.
