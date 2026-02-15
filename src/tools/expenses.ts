import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FreeAgentClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall, buildParams } from "../utils.js";

export function registerExpenseTools(server: McpServer, client: FreeAgentClient): void {
  server.tool(
    "freeagent_list_expenses",
    "List expenses from FreeAgent with optional filtering by view, date range, and project",
    {
      view: z
        .enum(["recent", "recurring"])
        .optional()
        .describe("Filter expenses by view"),
      from_date: z
        .string()
        .optional()
        .describe("Start date filter (YYYY-MM-DD)"),
      to_date: z
        .string()
        .optional()
        .describe("End date filter (YYYY-MM-DD)"),
      updated_since: z
        .string()
        .optional()
        .describe("Only return expenses updated since this ISO 8601 timestamp"),
      project: z
        .string()
        .optional()
        .describe("Filter by project URL"),
    },
    async ({ view, from_date, to_date, updated_since, project }) => {
      logToolCall("freeagent_list_expenses", { view, from_date, to_date, updated_since, project });
      try {
        const params = buildParams({ view, from_date, to_date, updated_since, project });
        const data = await client.get("/expenses", params);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_get_expense",
    "Get a single expense from FreeAgent by ID",
    {
      expense_id: z.string().describe("The ID of the expense to retrieve"),
    },
    async ({ expense_id }) => {
      logToolCall("freeagent_get_expense", { expense_id });
      try {
        const data = await client.get(`/expenses/${expense_id}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_create_expense",
    "Create a new expense in FreeAgent",
    {
      user: z.string().describe("User URL for the expense owner"),
      category: z.string().describe("Category URL for the expense"),
      dated_on: z.string().describe("Date of the expense (YYYY-MM-DD)"),
      gross_value: z.string().describe("Gross value as a decimal string"),
      currency: z.string().optional().describe("Currency code (e.g. GBP, USD)"),
      description: z.string().optional().describe("Description of the expense"),
      sales_tax_rate: z
        .string()
        .optional()
        .describe("Sales tax rate as a decimal string"),
      project: z.string().optional().describe("Project URL to associate with"),
      rebill_type: z
        .string()
        .optional()
        .describe("Rebill type for the expense"),
      receipt_reference: z
        .string()
        .optional()
        .describe("Receipt reference for the expense"),
    },
    async ({
      user,
      category,
      dated_on,
      gross_value,
      currency,
      description,
      sales_tax_rate,
      project,
      rebill_type,
      receipt_reference,
    }) => {
      logToolCall("freeagent_create_expense", { user, category, dated_on, gross_value });
      try {
        const expense: Record<string, unknown> = {
          user,
          category,
          dated_on,
          gross_value,
        };
        if (currency !== undefined) expense.currency = currency;
        if (description !== undefined) expense.description = description;
        if (sales_tax_rate !== undefined) expense.sales_tax_rate = sales_tax_rate;
        if (project !== undefined) expense.project = project;
        if (rebill_type !== undefined) expense.rebill_type = rebill_type;
        if (receipt_reference !== undefined) expense.receipt_reference = receipt_reference;

        const data = await client.postJson("/expenses", { expense });
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_update_expense",
    "Update an existing expense in FreeAgent",
    {
      expense_id: z.string().describe("The ID of the expense to update"),
      category: z.string().optional().describe("Category URL for the expense"),
      dated_on: z
        .string()
        .optional()
        .describe("Date of the expense (YYYY-MM-DD)"),
      gross_value: z
        .string()
        .optional()
        .describe("Gross value as a decimal string"),
      description: z.string().optional().describe("Description of the expense"),
      sales_tax_rate: z
        .string()
        .optional()
        .describe("Sales tax rate as a decimal string"),
      project: z.string().optional().describe("Project URL to associate with"),
      receipt_reference: z
        .string()
        .optional()
        .describe("Receipt reference for the expense"),
    },
    async ({
      expense_id,
      category,
      dated_on,
      gross_value,
      description,
      sales_tax_rate,
      project,
      receipt_reference,
    }) => {
      logToolCall("freeagent_update_expense", { expense_id });
      try {
        const expense: Record<string, unknown> = {};
        if (category !== undefined) expense.category = category;
        if (dated_on !== undefined) expense.dated_on = dated_on;
        if (gross_value !== undefined) expense.gross_value = gross_value;
        if (description !== undefined) expense.description = description;
        if (sales_tax_rate !== undefined) expense.sales_tax_rate = sales_tax_rate;
        if (project !== undefined) expense.project = project;
        if (receipt_reference !== undefined) expense.receipt_reference = receipt_reference;

        const data = await client.putJson(`/expenses/${expense_id}`, { expense });
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_delete_expense",
    "Delete an expense from FreeAgent",
    {
      expense_id: z.string().describe("The ID of the expense to delete"),
    },
    async ({ expense_id }) => {
      logToolCall("freeagent_delete_expense", { expense_id });
      try {
        const data = await client.deleteReq(`/expenses/${expense_id}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
