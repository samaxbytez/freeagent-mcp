# AGENTS.md

Project guidance for Claude Code working in this repository.

## What this is

`freeagent-mcp-server` — an MCP (Model Context Protocol) server that exposes the
[FreeAgent](https://dev.freeagent.com/) accounting API as tools for LLM clients.
TypeScript, ESM, published to npm, driven over stdio.

## Architecture

```
src/
├── index.ts      # Entry point: builds the McpServer, wires the client, registers every tool group
├── auth.ts       # OAuth2 flow, token storage (~/.freeagent-mcp/tokens.json) and refresh
├── client.ts     # FreeAgentClient — HTTP wrapper around fetch (get/postJson/putJson/deleteReq)
├── utils.ts      # Shared helpers: jsonResponse, errorResponse, logToolCall, buildParams, safeId, constants
└── tools/        # One file per FreeAgent resource, each exporting registerXxxTools(server, client)
```

Tests are co-located as `*.test.ts` and run with **vitest**.

## Tool pattern

Every resource file exports a `registerXxxTools(server, client)` function and
registers tools with `server.tool(...)` (or `server.registerTool(...)`). Each
handler:

1. Calls `logToolCall(name, args)` first.
2. Uses the `client` to hit the API (paths are relative, e.g. `` `/contacts/${id}` ``).
3. Wraps the result in `jsonResponse(data)` and errors in `errorResponse(err)`.
4. Uses `buildParams(...)` for query strings.

**IDs are interpolated into request paths**, so every ID parameter MUST use the
`safeId` schema from `utils.ts` (`z` string matching `/^[a-zA-Z0-9_-]+$/`), not a
plain `z.string()`. See any `freeagent_get_*` tool for the canonical shape.

To add a tool, use the `/add-tool` command — it scaffolds handler, registration,
and test following this pattern.

## Security conventions (this repo's threat model is indirect prompt injection)

- **IDs** → always `safeId` (blocks path traversal via ID fields).
- **`client.ts`** rejects absolute URLs / `../` and verifies the resolved URL's
  origin matches the API base — never weaken this; it prevents the bearer token
  being sent off-origin.
- **Browser launch** uses `execFile` (never `exec`/shell) and `explorer.exe` on
  Windows — never reintroduce shell interpolation of a URL.
- **Token file** is written `0o600` in a `0o700` directory. Never log tokens.

## Conventions

- **Commits & PR titles**: Conventional Commits (`feat:`, `fix:`, `chore:`,
  `docs:`, `refactor:`, `test:`, `ci:`, `perf:`). `main` uses **squash merges**,
  so the **PR title becomes the commit** the release tooling reads — keep it valid.
- **Never push to `main`** — it's protected (PR required, CI must pass,
  conversation resolution, no force-push/delete, enforced for admins). Branch and
  open a PR for everything, including config.
- **Tests must pass**: `npm test`, plus `npm run lint` and `npm run type-check`.

## Releasing (automated — never bump or publish by hand)

Conventional commits drive it. On merge to `main`, `release-agent.yml` opens a
release PR (version bump + changelog); merging that PR triggers `publish.yml`,
which publishes to npm via OIDC and creates the tag + GitHub Release. Full detail
in [RELEASING.md](RELEASING.md).

## Don'ts

- Don't run `npm publish` or create tags manually.
- Don't commit secrets (`ANTHROPIC_API_KEY`, `RELEASE_PAT` live in repo secrets).
- Don't relax `safeId` / the client origin check / `execFile` usage.
