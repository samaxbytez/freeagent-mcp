---
description: Recount the tools in src/tools and update the counts in the docs
---

The docs state a total tool count and per-group counts in several places. These
drift as tools are added. Reconcile them with the source of truth.

1. Count registered tools per file by grepping `src/tools/*.ts` for
   `server.tool(` and `server.registerTool(` (count tool registrations, not
   helper calls).
2. Compute the total across all files.
3. Update:
   - `README.md`: the intro ("76 tools …"), the "Tools" column of the
     "What it can do" table, and "All N tools" in the Documentation table;
   - `docs/tools.md`: the opening line and each "## <Group> (N tools)" heading;
   - `docs/development.md`: the per-file counts in the "What's where" tree;
   - `docs/README.md`: "All N tools".
4. Show a short before/after diff of the numbers you changed. Do not touch tool
   descriptions or any other prose.

This is docs-only — no source changes.
