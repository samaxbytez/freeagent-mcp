# Releasing

Releases are automated and driven by [Conventional Commits](https://www.conventionalcommits.org/).
You never bump the version or run `npm publish` by hand.

## How it works

```
merge feat/fix PR to main
        │
        ▼
release-agent.yml  ── reads commits since last tag, decides the semver bump,
(Claude Code)         opens/updates the "release PR" (branch: release/next)
        │             bumping package.json + CHANGELOG.md (+ README version)
        ▼
   you review &
   merge release PR
        │
        ▼
publish.yml  ── version changed → publishes to npm (OIDC, with provenance),
                creates the vX.Y.Z tag and the GitHub Release
```

The version bump follows the commit types since the last release:

| Commit type | Bump |
|-------------|------|
| `feat:` | minor |
| `fix:` / `perf:` | patch |
| `feat!:` or `BREAKING CHANGE:` footer | major |
| `chore:` `docs:` `refactor:` `test:` `ci:` | no release |

Because `main` uses **squash merges**, the **PR title** must be a valid
Conventional Commit — that title becomes the commit the release agent reads.

## To cut a release

1. Merge your `feat:` / `fix:` PRs to `main` as usual.
2. The **release agent** opens (or updates) a `chore: release X.Y.Z` PR. Review it
   — adjust the changelog wording if you like.
3. Merge the release PR. The publish workflow does the rest.

To skip an unwanted release, just don't merge the release PR; it stays current as
more changes land.

## Release procedure (single source of truth)

Both the automated release agent (`release-agent.yml`) and the manual `/release`
command follow these exact steps to author/update the release PR. **Edit this
section, not those two** — they are thin pointers here.

1. `git fetch --tags --force`, then find the latest semver tag:
   `git tag --sort=-v:refname | head -1` (call it `LAST_TAG`). If there is no tag,
   treat the entire history as releasable.
2. Read the **full** commit messages since `LAST_TAG` — subjects AND
   bodies/footers (breaking changes can be declared in a footer):
   `git log LAST_TAG..HEAD --pretty=format:'%H%n%B%n---'` (full history if no tag).
3. Decide the semver bump relative to the current `package.json` version:
   - a `!` after the type in the subject (e.g. `feat!:`, `fix!:`, `refactor!:`)
     **or** a `BREAKING CHANGE:` / `BREAKING-CHANGE:` footer in any body →
     **major** (regardless of the commit type);
   - else any `feat` → **minor**;
   - else any `fix` or `perf` → **patch**.
   If nothing is releasable, stop and do nothing.
4. Set git identity, then reset the release branch from the current `main`:
   ```
   git config user.name "github-actions[bot]"
   git config user.email "github-actions[bot]@users.noreply.github.com"
   git checkout -B release/next
   ```
5. Bump the version **without** tagging:
   `npm version <newversion> --no-git-tag-version` (updates `package.json` and
   `package-lock.json`).
6. Update `CHANGELOG.md`: prepend a `## [<newversion>] - <YYYY-MM-DD>` section
   (use `date +%F`) in the existing Keep a Changelog style. Group bullets under
   Added / Changed / Fixed / Security by commit type (feat→Added, fix→Fixed,
   security-related→Security, others→Changed). Write concise human-readable
   summaries, not raw commit lines. Update the version-compare links at the bottom.
7. If `README.md` contains a hardcoded version (e.g. `freeagent-mcp-server@X.Y.Z`),
   update it. Change nothing else in the README.
8. Commit and push the branch:
   ```
   git add -A
   git commit -m "chore: release <newversion>"
   git push -f origin release/next
   ```
9. Open or update the PR (head `release/next`, base `main`):
   - if one is open (`gh pr list --head release/next --state open --json number`),
     update it with `gh pr edit <num> --title ... --body ...`;
   - otherwise create it with `gh pr create --base main --head release/next
     --title "chore: release <newversion>" --body ...`.
   The body explains the bump rationale and changelog highlights, and notes that
   merging triggers the npm publish.

**Hard rules (never violate):** never run `npm publish`, never create a `git tag`,
never `npm version` with tagging, never push to `main`, never edit any file under
`.github/`. Only modify `package.json`, `package-lock.json`, `CHANGELOG.md`, and a
version string in `README.md`.

## One-time setup

The release agent needs:

- Repo secret **`ANTHROPIC_API_KEY`** — for the Claude Code action.
- Repo secret **`RELEASE_PAT`** — a fine-grained PAT (Contents + Pull requests:
  read & write). Required because PRs opened with the default `GITHUB_TOKEN` do
  not trigger CI, so required checks would never run on the release PR.
- **Settings → Actions → General → "Allow GitHub Actions to create and approve
  pull requests"** enabled.
- Repo **variable** **`RELEASE_AGENT_ENABLED`** set to `true` — the master
  on/off switch. The agent stays dormant until this is `true`, so the two secrets
  can hold placeholder values without causing failing runs. Flip it on only after
  the real secret values are in place.

npm publishing uses a **Trusted Publisher (OIDC)** bound to `publish.yml` — no
npm token is stored anywhere, and only `publish.yml` can publish.
