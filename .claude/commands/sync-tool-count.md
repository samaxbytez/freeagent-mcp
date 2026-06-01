---
description: Recount the tools in src/tools and update the counts in README.md
---

The README states a total tool count ("Provides N tools …") and a per-group
count in each "### <Group> (N tools)" heading and the Architecture tree. These
drift as tools are added. Reconcile them with the source of truth.

1. Count registered tools per file by grepping `src/tools/*.ts` for
   `server.tool(` and `server.registerTool(` (count tool registrations, not
   helper calls).
2. Compute the total across all files.
3. Update in `README.md`:
   - the intro line "Provides N tools …",
   - each "### <Group> (N tools)" heading,
   - the per-file counts in the Architecture tree comments.
4. Show a short before/after diff of the numbers you changed. Do not touch tool
   descriptions or any other prose.

This is README-only — no source changes.
