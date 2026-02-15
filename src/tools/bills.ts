import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FreeAgentClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall, buildParams } from "../utils.js";

export function registerBillTools(server: McpServer, client: FreeAgentClient): void {
  // List bills
  server.tool(
    "freeagent_list_bills",
    "List bills from FreeAgent with optional filtering by view, date range, contact, or project",
    {
      view: z
        .enum(["all", "open", "overdue", "open_or_overdue", "paid", "recurring"])
        .optional()
        .describe("Filter bills by view"),
      from_date: z
        .string()
        .optional()
        .describe("Filter bills from this date (YYYY-MM-DD)"),
      to_date: z
        .string()
        .optional()
        .describe("Filter bills to this date (YYYY-MM-DD)"),
      updated_since: z
        .string()
        .optional()
        .describe("Only return bills updated since this ISO 8601 date"),
      contact: z
        .string()
        .optional()
        .describe("Filter by contact URL"),
      project: z
        .string()
        .optional()
        .describe("Filter by project URL"),
      nested_bill_items: z
        .boolean()
        .optional()
        .describe("Whether to include nested bill items in the response"),
    },
    async ({ view, from_date, to_date, updated_since, contact, project, nested_bill_items }) => {
      logToolCall("freeagent_list_bills", { view, from_date, to_date, updated_since, contact, project, nested_bill_items });
      try {
        const params = buildParams({ view, from_date, to_date, updated_since, contact, project, nested_bill_items });
        const data = await client.get("/bills", params);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Get bill
  server.tool(
    "freeagent_get_bill",
    "Get a single bill from FreeAgent by ID",
    {
      bill_id: z.string().describe("The ID of the bill to retrieve"),
    },
    async ({ bill_id }) => {
      logToolCall("freeagent_get_bill", { bill_id });
      try {
        const data = await client.get(`/bills/${bill_id}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Create bill
  server.tool(
    "freeagent_create_bill",
    "Create a new bill in FreeAgent. bill_items should be a JSON string array of objects with category (URL), description, total_value, and sales_tax_rate.",
    {
      contact: z.string().describe("Contact URL for the bill"),
      reference: z.string().describe("Bill reference"),
      dated_on: z.string().describe("Bill date (YYYY-MM-DD)"),
      due_on: z.string().describe("Bill due date (YYYY-MM-DD)"),
      bill_items: z
        .string()
        .describe('JSON array of bill items, e.g. [{"category":"https://...","description":"Item","total_value":"100.00","sales_tax_rate":"20.0"}]'),
      currency: z.string().optional().describe("Currency code, e.g. GBP"),
      comments: z.string().optional().describe("Comments on the bill"),
    },
    async ({ contact, reference, dated_on, due_on, bill_items, currency, comments }) => {
      logToolCall("freeagent_create_bill", { contact, reference, dated_on, due_on });
      try {
        const parsedItems = JSON.parse(bill_items);
        const bill: Record<string, unknown> = {
          contact,
          reference,
          dated_on,
          due_on,
          bill_items: parsedItems,
        };
        if (currency !== undefined) bill.currency = currency;
        if (comments !== undefined) bill.comments = comments;

        const data = await client.postJson("/bills", { bill });
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Update bill
  server.tool(
    "freeagent_update_bill",
    "Update an existing bill in FreeAgent",
    {
      bill_id: z.string().describe("The ID of the bill to update"),
      reference: z.string().optional().describe("Bill reference"),
      dated_on: z.string().optional().describe("Bill date (YYYY-MM-DD)"),
      due_on: z.string().optional().describe("Bill due date (YYYY-MM-DD)"),
      comments: z.string().optional().describe("Comments on the bill"),
    },
    async ({ bill_id, ...rest }) => {
      logToolCall("freeagent_update_bill", { bill_id, ...rest });
      try {
        const bill: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rest)) {
          if (v !== undefined) bill[k] = v;
        }
        const data = await client.putJson(`/bills/${bill_id}`, { bill });
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Delete bill
  server.tool(
    "freeagent_delete_bill",
    "Delete a bill from FreeAgent",
    {
      bill_id: z.string().describe("The ID of the bill to delete"),
    },
    async ({ bill_id }) => {
      logToolCall("freeagent_delete_bill", { bill_id });
      try {
        const data = await client.deleteReq(`/bills/${bill_id}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
