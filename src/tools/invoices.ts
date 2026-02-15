import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FreeAgentClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall, buildParams } from "../utils.js";

export function registerInvoiceTools(server: McpServer, client: FreeAgentClient): void {
  // List invoices
  server.tool(
    "freeagent_list_invoices",
    "List invoices from FreeAgent, optionally filtered by view, sort order, contact, project, or updated date",
    {
      view: z.enum(["recent_open_or_overdue", "open", "overdue", "draft", "scheduled", "thank_you", "reminder", "all"]).optional().describe("Filter invoices by status view"),
      sort: z.string().optional().describe("Sort order for results"),
      contact: z.string().optional().describe("Filter by contact URL"),
      project: z.string().optional().describe("Filter by project URL"),
      updated_since: z.string().optional().describe("Filter invoices updated since this date (ISO 8601)"),
      nested_invoice_items: z.boolean().optional().describe("Whether to include nested invoice items in the response"),
    },
    async ({ view, sort, contact, project, updated_since, nested_invoice_items }) => {
      logToolCall("freeagent_list_invoices", { view, sort, contact, project, updated_since, nested_invoice_items });
      try {
        const params = buildParams({ view, sort, contact, project, updated_since, nested_invoice_items });
        const data = await client.get("/invoices", params);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Get invoice
  server.tool(
    "freeagent_get_invoice",
    "Get a single invoice from FreeAgent by ID",
    {
      invoice_id: z.string().describe("The invoice ID"),
    },
    async ({ invoice_id }) => {
      logToolCall("freeagent_get_invoice", { invoice_id });
      try {
        const data = await client.get(`/invoices/${invoice_id}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Create invoice
  server.tool(
    "freeagent_create_invoice",
    "Create a new invoice in FreeAgent",
    {
      contact: z.string().describe("Contact URL (e.g. https://api.freeagent.com/v2/contacts/123)"),
      dated_on: z.string().describe("Invoice date (YYYY-MM-DD)"),
      payment_terms_in_days: z.number().describe("Payment terms in days (e.g. 30)"),
      reference: z.string().optional().describe("Invoice reference"),
      currency: z.string().optional().describe("Currency code (e.g. GBP, USD)"),
      exchange_rate: z.string().optional().describe("Exchange rate"),
      payment_methods: z.string().optional().describe("Payment methods"),
      comments: z.string().optional().describe("Comments to appear on the invoice"),
      ec_status: z.string().optional().describe("EC status for EU VAT"),
      invoice_items: z.string().optional().describe("JSON string of array of invoice items. Each item has fields: item_type (Hours/Days/Weeks/Months/Years/Products/Comment/Rebilling), quantity (string), price (string), description (string)"),
    },
    async ({ invoice_items, ...rest }) => {
      logToolCall("freeagent_create_invoice", { ...rest, invoice_items });
      try {
        const invoice: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rest)) {
          if (v !== undefined) invoice[k] = v;
        }
        if (invoice_items) {
          invoice.invoice_items = JSON.parse(invoice_items);
        }
        const data = await client.postJson("/invoices", { invoice });
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Update invoice
  server.tool(
    "freeagent_update_invoice",
    "Update an existing invoice in FreeAgent",
    {
      invoice_id: z.string().describe("The invoice ID"),
      dated_on: z.string().optional().describe("Invoice date (YYYY-MM-DD)"),
      payment_terms_in_days: z.number().optional().describe("Payment terms in days"),
      reference: z.string().optional().describe("Invoice reference"),
      currency: z.string().optional().describe("Currency code"),
      comments: z.string().optional().describe("Comments to appear on the invoice"),
    },
    async ({ invoice_id, ...rest }) => {
      logToolCall("freeagent_update_invoice", { invoice_id, ...rest });
      try {
        const invoice: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rest)) {
          if (v !== undefined) invoice[k] = v;
        }
        const data = await client.putJson(`/invoices/${invoice_id}`, { invoice });
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Delete invoice
  server.tool(
    "freeagent_delete_invoice",
    "Delete an invoice from FreeAgent",
    {
      invoice_id: z.string().describe("The invoice ID"),
    },
    async ({ invoice_id }) => {
      logToolCall("freeagent_delete_invoice", { invoice_id });
      try {
        const data = await client.deleteReq(`/invoices/${invoice_id}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Mark invoice as sent
  server.tool(
    "freeagent_mark_invoice_as_sent",
    "Mark an invoice as sent in FreeAgent",
    {
      invoice_id: z.string().describe("The invoice ID"),
    },
    async ({ invoice_id }) => {
      logToolCall("freeagent_mark_invoice_as_sent", { invoice_id });
      try {
        const data = await client.putJson(`/invoices/${invoice_id}/transitions/mark_as_sent`, {});
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Mark invoice as draft
  server.tool(
    "freeagent_mark_invoice_as_draft",
    "Mark an invoice as draft in FreeAgent",
    {
      invoice_id: z.string().describe("The invoice ID"),
    },
    async ({ invoice_id }) => {
      logToolCall("freeagent_mark_invoice_as_draft", { invoice_id });
      try {
        const data = await client.putJson(`/invoices/${invoice_id}/transitions/mark_as_draft`, {});
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Mark invoice as cancelled
  server.tool(
    "freeagent_mark_invoice_as_cancelled",
    "Cancel an invoice in FreeAgent",
    {
      invoice_id: z.string().describe("The invoice ID"),
    },
    async ({ invoice_id }) => {
      logToolCall("freeagent_mark_invoice_as_cancelled", { invoice_id });
      try {
        const data = await client.putJson(`/invoices/${invoice_id}/transitions/mark_as_cancelled`, {});
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Send invoice email
  server.tool(
    "freeagent_send_invoice_email",
    "Send an invoice by email from FreeAgent",
    {
      invoice_id: z.string().describe("The invoice ID"),
      to: z.string().describe("Recipient email address"),
      from_email: z.string().optional().describe("Sender email address"),
      subject: z.string().optional().describe("Email subject line"),
      body: z.string().optional().describe("Email body text"),
    },
    async ({ invoice_id, to, from_email, subject, body }) => {
      logToolCall("freeagent_send_invoice_email", { invoice_id, to, from_email, subject });
      try {
        const emailBody: Record<string, unknown> = { to };
        if (from_email !== undefined) emailBody.from = from_email;
        if (subject !== undefined) emailBody.subject = subject;
        if (body !== undefined) emailBody.body = body;
        const data = await client.postJson(`/invoices/${invoice_id}/send_email`, { invoice: { email: emailBody } });
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
