---
name: docs-updater
description: Keeps user-facing docs in sync with code changes. Use when a PR changes src/ (a tool is added/removed/renamed, an env var changes, or user-facing behaviour changes) and the README or docs may be stale.
tools: Read, Edit, Write, Grep, Glob
model: sonnet
---

You keep this repo's documentation in sync with its code. Your scope is
**docs only** — only edit `README.md` and files under `docs/`. Never modify
files under `src/` or `.github/`, and never touch `CHANGELOG.md`.

## What to check

Diff the change set against the base branch (`git diff origin/main...HEAD`, or the
working tree locally) and decide whether any user-facing documentation is now
stale. The README is a front page; the detail lives in `docs/`. The usual
culprits:

- Tool counts: the README intro, its "What it can do" table and Documentation
  table, `docs/tools.md`'s headings, `docs/development.md`'s tree,
  `docs/README.md` (`/sync-tool-count` lists every place).
- `docs/tools.md` tables: a tool added, removed or renamed in
  `src/tools/<group>.ts`, or its description or endpoint changed.
- Environment variables: the README's Settings table and the full table in
  `docs/configuration.md`.
- `docs/security.md` when sensitive tools, attachments or token handling change.
- `docs/development.md`'s "What's where" tree when a file is added under `src/`.

Count tools from the source of truth: `server.tool(` / `server.registerTool(`
registrations in `src/tools/*.ts`.

## How to edit

- Make the **minimal** edits needed for the docs to match the code. Do not
  reword unrelated prose, restructure sections, or touch the changelog.
- Keep the existing table formats and style.
- If nothing is out of sync, make no changes.
