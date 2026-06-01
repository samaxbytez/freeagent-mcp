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

## One-time setup

The release agent needs:

- Repo secret **`ANTHROPIC_API_KEY`** — for the Claude Code action.
- Repo secret **`RELEASE_PAT`** — a fine-grained PAT (Contents + Pull requests:
  read & write). Required because PRs opened with the default `GITHUB_TOKEN` do
  not trigger CI, so required checks would never run on the release PR.
- **Settings → Actions → General → "Allow GitHub Actions to create and approve
  pull requests"** enabled.

npm publishing uses a **Trusted Publisher (OIDC)** bound to `publish.yml` — no
npm token is stored anywhere, and only `publish.yml` can publish.
