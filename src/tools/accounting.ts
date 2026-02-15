import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FreeAgentClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall, buildParams } from "../utils.js";

export function registerAccountingTools(server: McpServer, client: FreeAgentClient): void {
  server.tool(
    "freeagent_get_profit_and_loss",
    "Get the profit and loss summary from FreeAgent with optional date range filtering",
    {
      from_date: z
        .string()
        .optional()
        .describe("Start date for the P&L report in YYYY-MM-DD format"),
      to_date: z
        .string()
        .optional()
        .describe("End date for the P&L report in YYYY-MM-DD format"),
    },
    async ({ from_date, to_date }) => {
      logToolCall("freeagent_get_profit_and_loss", { from_date, to_date });
      try {
        const params = buildParams({ from_date, to_date });
        const data = await client.get("/accounting/profit_and_loss/summary", params);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_get_balance_sheet",
    "Get the balance sheet from FreeAgent, optionally as at a specific date",
    {
      as_at_date: z
        .string()
        .optional()
        .describe("Date to retrieve the balance sheet as at, in YYYY-MM-DD format"),
    },
    async ({ as_at_date }) => {
      logToolCall("freeagent_get_balance_sheet", { as_at_date });
      try {
        const params = buildParams({ as_at_date });
        const data = await client.get("/accounting/balance_sheet", params);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_get_opening_balances",
    "Get the opening balances from the FreeAgent balance sheet",
    {},
    async () => {
      logToolCall("freeagent_get_opening_balances");
      try {
        const data = await client.get("/accounting/balance_sheet/opening_balances");
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_get_trial_balance",
    "Get the trial balance summary from FreeAgent with optional date range filtering",
    {
      from_date: z
        .string()
        .optional()
        .describe("Start date for the trial balance in YYYY-MM-DD format"),
      to_date: z
        .string()
        .optional()
        .describe("End date for the trial balance in YYYY-MM-DD format"),
    },
    async ({ from_date, to_date }) => {
      logToolCall("freeagent_get_trial_balance", { from_date, to_date });
      try {
        const params = buildParams({ from_date, to_date });
        const data = await client.get("/accounting/trial_balance/summary", params);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_get_trial_balance_opening",
    "Get the trial balance opening balances from FreeAgent",
    {},
    async () => {
      logToolCall("freeagent_get_trial_balance_opening");
      try {
        const data = await client.get("/accounting/trial_balance/summary/opening_balances");
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
