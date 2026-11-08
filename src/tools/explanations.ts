import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FreeAgentClient, type RequestOptions } from "../client.js";
import { jsonResponse, errorResponse, logToolCall, buildParams, safeId, listResponse, paginationParams, definedOnly } from "../utils.js";
import { readAttachment } from "../attachment.js";

/**
 * From 1 December 2026 FreeAgent drops the inline `attachment` on explanations in
 * favour of an `attachments` array managed through its own endpoint. Opting in now
 * means every explanation call sees the same shape before and after that date.
 */
const VERSION: RequestOptions = { apiVersion: "2026-09-01" };

/** FreeAgent accepts at most 10 files per attachments request. */
const MAX_FILES_PER_REQUEST = 10;

// Fields shared by create and update. Values are strings, as elsewhere in this server,
// so decimals reach FreeAgent exactly as given.
const explanationFields = {
  dated_on: z.string().describe("Date of the explanation (YYYY-MM-DD)"),
  gross_value: z
    .string()
    .optional()
    .describe("Gross amount in the bank account's currency; negative for money out, e.g. \"-120.00\""),
  description: z.string().optional().describe("Description (not needed for transfers or invoice receipts)"),
  category: z
    .string()
    .optional()
    .describe("Category URL. Not needed when paying a bill or invoice, or for a transfer"),
  sales_tax_status: z
    .enum(["TAXABLE", "EXEMPT", "OUT_OF_SCOPE"])
    .optional()
    .describe("Whether the item is taxable, exempt or out of scope for VAT"),
  sales_tax_rate: z.string().optional().describe("VAT rate, e.g. \"20.0\""),
  sales_tax_value: z.string().optional().describe("VAT amount, if not derived from the rate"),
  ec_status: z
    .enum(["UK/Non-EC", "EC Goods", "EC Services", "Reverse Charge", "EC VAT MOSS"])
    .optional()
    .describe("EC VAT status"),
  paid_bill: z.string().optional().describe("Bill URL, to explain the transaction as a bill payment or refund"),
  paid_invoice: z
    .string()
    .optional()
    .describe("Invoice URL, to explain the transaction as an invoice receipt or credit note refund"),
  paid_user: z.string().optional().describe("User URL, for money paid to or received from a user"),
  transfer_bank_account: z
    .string()
    .optional()
    .describe("Bank account URL, to explain the transaction as a transfer to or from that account"),
  foreign_currency_value: z
    .string()
    .optional()
    .describe("Equivalent of gross_value in the bill's or invoice's currency, when it is foreign"),
  project: z.string().optional().describe("Project URL, to rebill the cost to a project"),
  rebill_type: z.enum(["cost", "markup", "price"]).optional().describe("How to rebill to the project"),
  rebill_factor: z.string().optional().describe("Markup or price factor; required for markup and price"),
  receipt_reference: z.string().optional().describe("Receipt reference"),
  cheque_number: z.string().optional().describe("Cheque number"),
  marked_for_review: z
    .boolean()
    .optional()
    .describe("True while the explanation awaits approval; set false to approve a guessed one"),
};

export function registerExplanationTools(server: McpServer, client: FreeAgentClient): void {
  server.tool(
    "freeagent_list_bank_transaction_explanations",
    "List bank transaction explanations for a bank account. To find transactions that still need explaining, use freeagent_list_bank_transactions with view \"unexplained\".",
    {
      bank_account: z.string().describe("The full URL of the bank account"),
      from_date: z.string().optional().describe("Start date for filtering (YYYY-MM-DD)"),
      to_date: z.string().optional().describe("End date for filtering (YYYY-MM-DD)"),
      updated_since: z
        .string()
        .optional()
        .describe("Only return explanations updated since this ISO 8601 date"),
      ...paginationParams,
    },
    async (args) => {
      logToolCall("freeagent_list_bank_transaction_explanations", args);
      try {
        const data = await client.getList("/bank_transaction_explanations", buildParams(args), VERSION);
        return listResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_get_bank_transaction_explanation",
    "Get a single bank transaction explanation from FreeAgent by ID",
    {
      explanation_id: safeId.describe("The ID of the explanation to retrieve"),
    },
    async ({ explanation_id }) => {
      logToolCall("freeagent_get_bank_transaction_explanation", { explanation_id });
      try {
        const data = await client.get(`/bank_transaction_explanations/${explanation_id}`, undefined, VERSION);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_create_bank_transaction_explanation",
    "Explain a bank transaction in FreeAgent: categorise it, or match it to a bill, invoice, user or transfer. " +
      "Set bank_transaction to explain an existing transaction, or bank_account to create the transaction along with its explanation. " +
      "Attach receipts afterwards with freeagent_add_bank_transaction_explanation_attachments.",
    {
      bank_transaction: z
        .string()
        .optional()
        .describe("URL of the bank transaction to explain. Give this or bank_account"),
      bank_account: z
        .string()
        .optional()
        .describe("URL of a bank account, to create a new transaction with this explanation. Give this or bank_transaction"),
      ...explanationFields,
    },
    async (args) => {
      logToolCall("freeagent_create_bank_transaction_explanation", {
        bank_transaction: args.bank_transaction,
        bank_account: args.bank_account,
        dated_on: args.dated_on,
        gross_value: args.gross_value,
      });
      try {
        if (!args.bank_transaction === !args.bank_account) {
          throw new Error("Give exactly one of bank_transaction or bank_account");
        }
        const data = await client.postJson(
          "/bank_transaction_explanations",
          { bank_transaction_explanation: definedOnly(args) },
          VERSION
        );
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_update_bank_transaction_explanation",
    "Update a bank transaction explanation, e.g. to correct or approve one FreeAgent guessed",
    {
      explanation_id: safeId.describe("The ID of the explanation to update"),
      ...explanationFields,
      dated_on: explanationFields.dated_on.optional(),
    },
    async ({ explanation_id, ...rest }) => {
      logToolCall("freeagent_update_bank_transaction_explanation", { explanation_id });
      try {
        const data = await client.putJson(
          `/bank_transaction_explanations/${explanation_id}`,
          { bank_transaction_explanation: definedOnly(rest) },
          VERSION
        );
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_delete_bank_transaction_explanation",
    "Delete a bank transaction explanation, leaving the transaction unexplained",
    {
      explanation_id: safeId.describe("The ID of the explanation to delete"),
    },
    async ({ explanation_id }) => {
      logToolCall("freeagent_delete_bank_transaction_explanation", { explanation_id });
      try {
        const data = await client.deleteReq(`/bank_transaction_explanations/${explanation_id}`, undefined, VERSION);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // ── Attachments ────────────────────────────────────────────────────

  server.tool(
    "freeagent_list_bank_transaction_explanation_attachments",
    "List the files attached to a bank transaction explanation. Save one locally with freeagent_download_attachment.",
    {
      explanation_id: safeId.describe("The ID of the explanation"),
    },
    async ({ explanation_id }) => {
      logToolCall("freeagent_list_bank_transaction_explanation_attachments", { explanation_id });
      try {
        const data = await client.get(
          `/bank_transaction_explanations/${explanation_id}/attachments`,
          undefined,
          VERSION
        );
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_add_bank_transaction_explanation_attachments",
    `Attach local receipt or invoice files to a bank transaction explanation (up to ${MAX_FILES_PER_REQUEST} per call, 50 per explanation). ` +
      "Files are read from FREEAGENT_ATTACHMENTS_DIR only.",
    {
      explanation_id: safeId.describe("The ID of the explanation"),
      attachment_paths: z
        .array(z.string())
        .min(1)
        .max(MAX_FILES_PER_REQUEST)
        .describe("Paths to local files to attach (PDF, PNG, JPEG or GIF, max 5MB each)"),
      description: z.string().optional().describe("Description applied to each attached file"),
    },
    async ({ explanation_id, attachment_paths, description }) => {
      logToolCall("freeagent_add_bank_transaction_explanation_attachments", { explanation_id, attachment_paths });
      try {
        // Read every file before sending any, so one bad path attaches nothing.
        const attachments = [];
        for (const p of attachment_paths) {
          attachments.push(definedOnly({ ...(await readAttachment(p)), description }));
        }
        const data = await client.postJson(
          `/bank_transaction_explanations/${explanation_id}/attachments`,
          { attachments },
          VERSION
        );
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_remove_bank_transaction_explanation_attachment",
    "Remove one file from a bank transaction explanation. Takes the attachment ID from its URL, e.g. https://api.freeagent.com/v2/attachments/123.",
    {
      explanation_id: safeId.describe("The ID of the explanation"),
      attachment_id: safeId.describe("The ID of the attachment to remove"),
    },
    async ({ explanation_id, attachment_id }) => {
      logToolCall("freeagent_remove_bank_transaction_explanation_attachment", { explanation_id, attachment_id });
      try {
        const data = await client.putJson(
          `/bank_transaction_explanations/${explanation_id}/attachments`,
          { attachments: [{ url: client.resourceUrl(`/attachments/${attachment_id}`), _destroy: "true" }] },
          VERSION
        );
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
