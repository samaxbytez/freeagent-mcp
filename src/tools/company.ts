import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FreeAgentClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall } from "../utils.js";

export function registerCompanyTools(
  server: McpServer,
  client: FreeAgentClient
): void {
  // Get company information
  server.registerTool(
    "freeagent_get_company",
    {
      title: "Get Company",
      description:
        "Get information about the authenticated FreeAgent company, including name, type, currency, and other settings.",
    },
    async () => {
      logToolCall("freeagent_get_company");
      try {
        const response = await client.get("/company");
        return jsonResponse(response);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // List business categories
  server.registerTool(
    "freeagent_list_business_categories",
    {
      title: "List Business Categories",
      description:
        "List the available business categories for the company. These are used to classify the type of business.",
    },
    async () => {
      logToolCall("freeagent_list_business_categories");
      try {
        const response = await client.get("/company/business_categories");
        return jsonResponse(response);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Get tax timeline
  server.registerTool(
    "freeagent_get_tax_timeline",
    {
      title: "Get Tax Timeline",
      description:
        "Get the tax timeline for the company, showing upcoming tax deadlines and obligations.",
    },
    async () => {
      logToolCall("freeagent_get_tax_timeline");
      try {
        const response = await client.get("/company/tax_timeline");
        return jsonResponse(response);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
