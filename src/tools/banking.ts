import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FreeAgentClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall, buildParams } from "../utils.js";

export function registerBankingTools(server: McpServer, client: FreeAgentClient): void {
  // ── Bank Accounts ──────────────────────────────────────────────────

  server.tool(
    "freeagent_list_bank_accounts",
    "List bank accounts from FreeAgent with optional view filter",
    {
      view: z
        .enum(["standard_bank_accounts", "credit_card_accounts", "paypal_accounts"])
        .optional()
        .describe("Filter bank accounts by type"),
    },
    async ({ view }) => {
      logToolCall("freeagent_list_bank_accounts", { view });
      try {
        const params = buildParams({ view });
        const data = await client.get("/bank_accounts", params);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_get_bank_account",
    "Get a single bank account from FreeAgent by ID",
    {
      bank_account_id: z.string().describe("The ID of the bank account to retrieve"),
    },
    async ({ bank_account_id }) => {
      logToolCall("freeagent_get_bank_account", { bank_account_id });
      try {
        const data = await client.get(`/bank_accounts/${bank_account_id}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_create_bank_account",
    "Create a new bank account in FreeAgent",
    {
      type: z
        .enum(["StandardBankAccount", "CreditCardAccount", "EcommerceAccount"])
        .describe("The type of bank account"),
      name: z.string().describe("Name for the bank account"),
      bank_name: z.string().describe("Name of the bank"),
      currency: z.string().optional().describe("Currency code (e.g. GBP, USD)"),
      opening_balance: z.string().optional().describe("Opening balance amount"),
      is_personal: z.boolean().optional().describe("Whether this is a personal account"),
      is_primary: z.boolean().optional().describe("Whether this is the primary account"),
      account_number: z.string().optional().describe("Bank account number"),
      sort_code: z.string().optional().describe("Bank sort code"),
      iban: z.string().optional().describe("IBAN number"),
      bic: z.string().optional().describe("BIC/SWIFT code"),
    },
    async ({
      type,
      name,
      bank_name,
      currency,
      opening_balance,
      is_personal,
      is_primary,
      account_number,
      sort_code,
      iban,
      bic,
    }) => {
      logToolCall("freeagent_create_bank_account", { type, name, bank_name });
      try {
        const bank_account: Record<string, unknown> = {
          type,
          name,
          bank_name,
        };
        if (currency !== undefined) bank_account.currency = currency;
        if (opening_balance !== undefined) bank_account.opening_balance = opening_balance;
        if (is_personal !== undefined) bank_account.is_personal = is_personal;
        if (is_primary !== undefined) bank_account.is_primary = is_primary;
        if (account_number !== undefined) bank_account.account_number = account_number;
        if (sort_code !== undefined) bank_account.sort_code = sort_code;
        if (iban !== undefined) bank_account.iban = iban;
        if (bic !== undefined) bank_account.bic = bic;

        const data = await client.postJson("/bank_accounts", { bank_account });
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_update_bank_account",
    "Update an existing bank account in FreeAgent",
    {
      bank_account_id: z.string().describe("The ID of the bank account to update"),
      name: z.string().optional().describe("Name for the bank account"),
      bank_name: z.string().optional().describe("Name of the bank"),
      is_primary: z.boolean().optional().describe("Whether this is the primary account"),
    },
    async ({ bank_account_id, name, bank_name, is_primary }) => {
      logToolCall("freeagent_update_bank_account", { bank_account_id });
      try {
        const bank_account: Record<string, unknown> = {};
        if (name !== undefined) bank_account.name = name;
        if (bank_name !== undefined) bank_account.bank_name = bank_name;
        if (is_primary !== undefined) bank_account.is_primary = is_primary;

        const data = await client.putJson(`/bank_accounts/${bank_account_id}`, { bank_account });
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_delete_bank_account",
    "Delete a bank account from FreeAgent",
    {
      bank_account_id: z.string().describe("The ID of the bank account to delete"),
    },
    async ({ bank_account_id }) => {
      logToolCall("freeagent_delete_bank_account", { bank_account_id });
      try {
        const data = await client.deleteReq(`/bank_accounts/${bank_account_id}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // ── Bank Transactions ──────────────────────────────────────────────

  server.tool(
    "freeagent_list_bank_transactions",
    "List bank transactions from FreeAgent for a specific bank account",
    {
      bank_account: z
        .string()
        .describe("The full URL of the bank account to list transactions for"),
      from_date: z.string().optional().describe("Start date for filtering (YYYY-MM-DD)"),
      to_date: z.string().optional().describe("End date for filtering (YYYY-MM-DD)"),
      updated_since: z
        .string()
        .optional()
        .describe("Only return transactions updated since this ISO 8601 date"),
      view: z
        .enum(["all", "unexplained", "explained", "manual", "imported", "marked_for_review"])
        .optional()
        .describe("Filter transactions by view"),
    },
    async ({ bank_account, from_date, to_date, updated_since, view }) => {
      logToolCall("freeagent_list_bank_transactions", { bank_account, from_date, to_date, view });
      try {
        const params = buildParams({ bank_account, from_date, to_date, updated_since, view });
        const data = await client.get("/bank_transactions", params);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_get_bank_transaction",
    "Get a single bank transaction from FreeAgent by ID",
    {
      bank_transaction_id: z.string().describe("The ID of the bank transaction to retrieve"),
    },
    async ({ bank_transaction_id }) => {
      logToolCall("freeagent_get_bank_transaction", { bank_transaction_id });
      try {
        const data = await client.get(`/bank_transactions/${bank_transaction_id}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
