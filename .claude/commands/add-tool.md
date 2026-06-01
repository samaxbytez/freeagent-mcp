---
description: Scaffold a new FreeAgent MCP tool (handler + registration + test) following the repo pattern
argument-hint: <resource-file> "<tool description>"
---

Add a new tool to this MCP server. Arguments: `$ARGUMENTS`
(first token = the `src/tools/<resource>.ts` file to add it to or create;
the rest = a short description of what the tool does).

Follow the repo's established pattern exactly — read an existing tool first
(e.g. `src/tools/contacts.ts`) and mirror it. Steps:

1. Decide the tool name (`freeagent_<verb>_<resource>`), HTTP method, and API
   path from the [FreeAgent API docs](https://dev.freeagent.com/docs).
2. In the target `src/tools/<resource>.ts`:
   - If the file is new, export `registerXxxTools(server, client)` and import the
     helpers: `jsonResponse, errorResponse, logToolCall, buildParams, safeId`.
   - Register the tool with `server.tool(...)`. The handler must:
     - call `logToolCall("<name>", args)` first,
     - call the `client` (`get` / `postJson` / `putJson` / `deleteReq`) with a
       **relative** path,
     - return `jsonResponse(data)` and wrap errors with `errorResponse`.
   - **Any ID parameter must use `safeId`**, never a plain `z.string()`.
   - Use `buildParams(...)` for query parameters.
3. If the file is new, import and call `registerXxxTools` in `src/index.ts`.
4. Add a test in `src/tools/tools.test.ts` mirroring the existing cases.
5. Update the tool count and the relevant table in `README.md` (or run
   `/sync-tool-count`).
6. Run `npm run lint`, `npm run type-check`, and `npm test` until green.

Do not invent API fields — confirm them against the FreeAgent docs. Stop and ask
if the resource's API shape is unclear.
