# Development

Node.js 24 or later. [AGENTS.md](../AGENTS.md) has the conventions and the
security rules that don't bend: read it before changing anything.

```bash
npm install
npm run type-check
npm test               # vitest, no network: the client is mocked
npm run test:watch
npm run lint
npm run format
npm run build          # tsc into build/
```

CI runs lint, type-check, tests and build on Node 24 for every pull request
(`test (24)`, required on `main`).

## What's where

```
src/
├── index.ts            # Entry point: builds the server, wires the client, registers every tool group
├── auth.ts             # OAuth2 flow, the callback server, token storage and refresh
├── client.ts           # FreeAgentClient: fetch wrapper, path and origin checks, pagination
├── policy.ts           # MCP annotations for every tool; sensitive tools behind an opt-in
├── attachment.ts       # attachment_path: the only local file read, confined to one directory
├── utils.ts            # jsonResponse, errorResponse, logToolCall, buildParams, safeId, pagination
├── *.test.ts           # Tests beside each module
└── tools/
    ├── company.ts        # 3 tools
    ├── users.ts          # 6 tools
    ├── contacts.ts       # 5 tools
    ├── projects.ts       # 5 tools
    ├── tasks.ts          # 5 tools
    ├── timeslips.ts      # 7 tools
    ├── invoices.ts       # 9 tools
    ├── estimates.ts      # 7 tools
    ├── bills.ts          # 5 tools
    ├── credit-notes.ts   # 5 tools
    ├── expenses.ts       # 5 tools
    ├── banking.ts        # 7 tools
    ├── categories.ts     # 2 tools
    ├── accounting.ts     # 5 tools
    ├── tools.test.ts     # Handlers, and the path-traversal check over every tool
    └── attachments.test.ts
```

## Adding a tool

Run `/add-tool` in Claude Code: it scaffolds the handler, the registration and a
test in this repo's pattern. By hand:

1. Add it to the resource's file in `src/tools/` (or a new
   `registerXxxTools(server, client)` file, called from `src/index.ts`).
2. Call `logToolCall()` first, wrap results in `jsonResponse()` and errors in
   `errorResponse()`, and build query strings with `buildParams()`.
3. Every ID that goes into a request path uses the `safeId` schema, never a plain
   `z.string()`. The "path parameters across all tools" test fails otherwise.
4. A list tool spreads `paginationParams` into its schema and returns
   `listResponse(await client.getList(...))`.
5. A tool that could grant account access or send data out of the account goes in
   `SENSITIVE_TOOLS` in `src/policy.ts`.
6. Add tests, then run `/sync-tool-count` to update the counts in
   [tools.md](tools.md) and the README.

## Releasing

Run `/release` on an up-to-date `main`: it opens the `chore: release X.Y.Z` PR
from the conventional commits since the last tag. Merging that PR builds the
release; approving the `npm-publish` deployment in Actions publishes it to npm and
tags it. Never run `npm publish` or create tags by hand. Full
detail: [RELEASING.md](../RELEASING.md).
