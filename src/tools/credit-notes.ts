import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FreeAgentClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall, buildParams } from "../utils.js";

export function registerCreditNoteTools(server: McpServer, client: FreeAgentClient): void {
  // List credit notes
  server.tool(
    "freeagent_list_credit_notes",
    "List credit notes from FreeAgent with optional filtering and sorting",
    {
      view: z
        .enum(["all", "recent_open_or_overdue", "open", "overdue", "draft", "refunded"])
        .optional()
        .describe("Filter credit notes by view"),
      updated_since: z
        .string()
        .optional()
        .describe("Only return credit notes updated since this ISO 8601 date"),
      sort: z
        .string()
        .optional()
        .describe('Sort order, e.g. "created_at" or "-updated_at"'),
      contact: z
        .string()
        .optional()
        .describe("Filter by contact URL"),
      project: z
        .string()
        .optional()
        .describe("Filter by project URL"),
      nested_credit_note_items: z
        .boolean()
        .optional()
        .describe("Whether to include nested credit note items in the response"),
    },
    async ({ view, updated_since, sort, contact, project, nested_credit_note_items }) => {
      logToolCall("freeagent_list_credit_notes", { view, updated_since, sort, contact, project, nested_credit_note_items });
      try {
        const params = buildParams({ view, updated_since, sort, contact, project, nested_credit_note_items });
        const data = await client.get("/credit_notes", params);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Get credit note
  server.tool(
    "freeagent_get_credit_note",
    "Get a single credit note from FreeAgent by ID",
    {
      credit_note_id: z.string().describe("The ID of the credit note to retrieve"),
    },
    async ({ credit_note_id }) => {
      logToolCall("freeagent_get_credit_note", { credit_note_id });
      try {
        const data = await client.get(`/credit_notes/${credit_note_id}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Create credit note
  server.tool(
    "freeagent_create_credit_note",
    "Create a new credit note in FreeAgent",
    {
      contact: z.string().describe("Contact URL for the credit note"),
      dated_on: z.string().describe("Credit note date in YYYY-MM-DD format"),
      payment_terms_in_days: z
        .number()
        .optional()
        .describe("Payment terms in days"),
      currency: z
        .string()
        .optional()
        .describe("Currency code, e.g. GBP, USD"),
      comments: z
        .string()
        .optional()
        .describe("Comments or notes for the credit note"),
      credit_note_items: z
        .string()
        .optional()
        .describe("JSON array of credit note line items, each with item_type, quantity, price, description"),
    },
    async ({ contact, dated_on, payment_terms_in_days, currency, comments, credit_note_items }) => {
      logToolCall("freeagent_create_credit_note", { contact, dated_on, currency });
      try {
        const credit_note: Record<string, unknown> = { contact, dated_on };
        if (payment_terms_in_days !== undefined) credit_note.payment_terms_in_days = payment_terms_in_days;
        if (currency !== undefined) credit_note.currency = currency;
        if (comments !== undefined) credit_note.comments = comments;
        if (credit_note_items !== undefined) credit_note.credit_note_items = JSON.parse(credit_note_items);

        const data = await client.postJson("/credit_notes", { credit_note });
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Update credit note
  server.tool(
    "freeagent_update_credit_note",
    "Update an existing credit note in FreeAgent",
    {
      credit_note_id: z.string().describe("The ID of the credit note to update"),
      dated_on: z
        .string()
        .optional()
        .describe("Credit note date in YYYY-MM-DD format"),
      payment_terms_in_days: z
        .number()
        .optional()
        .describe("Payment terms in days"),
      comments: z
        .string()
        .optional()
        .describe("Comments or notes for the credit note"),
    },
    async ({ credit_note_id, dated_on, payment_terms_in_days, comments }) => {
      logToolCall("freeagent_update_credit_note", { credit_note_id });
      try {
        const credit_note: Record<string, unknown> = {};
        if (dated_on !== undefined) credit_note.dated_on = dated_on;
        if (payment_terms_in_days !== undefined) credit_note.payment_terms_in_days = payment_terms_in_days;
        if (comments !== undefined) credit_note.comments = comments;

        const data = await client.putJson(`/credit_notes/${credit_note_id}`, { credit_note });
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Delete credit note
  server.tool(
    "freeagent_delete_credit_note",
    "Delete a credit note from FreeAgent",
    {
      credit_note_id: z.string().describe("The ID of the credit note to delete"),
    },
    async ({ credit_note_id }) => {
      logToolCall("freeagent_delete_credit_note", { credit_note_id });
      try {
        const data = await client.deleteReq(`/credit_notes/${credit_note_id}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
