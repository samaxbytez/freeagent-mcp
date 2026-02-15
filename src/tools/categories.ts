import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FreeAgentClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall, buildParams } from "../utils.js";

export function registerCategoryTools(server: McpServer, client: FreeAgentClient): void {
  server.tool(
    "freeagent_list_categories",
    "List all categories from FreeAgent, optionally including sub-accounts",
    {
      sub_accounts: z
        .boolean()
        .optional()
        .describe("Whether to include sub-accounts in the response"),
    },
    async ({ sub_accounts }) => {
      logToolCall("freeagent_list_categories", { sub_accounts });
      try {
        const params = buildParams({ sub_accounts });
        const data = await client.get("/categories", params);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_get_category",
    "Get a single category from FreeAgent by nominal code",
    {
      nominal_code: z.string().describe("The nominal code of the category to retrieve"),
    },
    async ({ nominal_code }) => {
      logToolCall("freeagent_get_category", { nominal_code });
      try {
        const data = await client.get(`/categories/${nominal_code}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
