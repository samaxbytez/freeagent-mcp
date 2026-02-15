import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FreeAgentClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall, buildParams } from "../utils.js";

export function registerEstimateTools(server: McpServer, client: FreeAgentClient): void {
  // List estimates
  server.tool(
    "freeagent_list_estimates",
    "List estimates from FreeAgent with optional filtering",
    {
      view: z.string().optional().describe("Filter estimates by view"),
      from_date: z.string().optional().describe("Filter estimates from this date (YYYY-MM-DD)"),
      to_date: z.string().optional().describe("Filter estimates to this date (YYYY-MM-DD)"),
      updated_since: z
        .string()
        .optional()
        .describe("Only return estimates updated since this ISO 8601 date"),
      nested_estimate_items: z
        .boolean()
        .optional()
        .describe("Include nested estimate items in the response"),
      contact: z.string().optional().describe("Filter by contact URL"),
      project: z.string().optional().describe("Filter by project URL"),
    },
    async ({ view, from_date, to_date, updated_since, nested_estimate_items, contact, project }) => {
      logToolCall("freeagent_list_estimates", { view, from_date, to_date, updated_since, nested_estimate_items, contact, project });
      try {
        const params = buildParams({ view, from_date, to_date, updated_since, nested_estimate_items, contact, project });
        const data = await client.get("/estimates", params);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Get estimate
  server.tool(
    "freeagent_get_estimate",
    "Get a single estimate from FreeAgent by ID",
    {
      estimate_id: z.string().describe("The estimate ID"),
    },
    async ({ estimate_id }) => {
      logToolCall("freeagent_get_estimate", { estimate_id });
      try {
        const data = await client.get(`/estimates/${estimate_id}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Create estimate
  server.tool(
    "freeagent_create_estimate",
    "Create a new estimate in FreeAgent",
    {
      contact: z.string().describe("Contact URL"),
      estimate_type: z
        .enum(["Estimate", "Quote", "Proposal"])
        .describe("Type of estimate"),
      dated_on: z.string().describe("Estimate date (YYYY-MM-DD)"),
      currency: z.string().describe("Currency code"),
      reference: z.string().optional().describe("Estimate reference"),
      payment_terms_in_days: z
        .number()
        .optional()
        .describe("Payment terms in days"),
      comments: z.string().optional().describe("Comments on the estimate"),
      estimate_items: z
        .string()
        .optional()
        .describe("JSON array of estimate items with item_type, quantity, price, description"),
    },
    async ({
      contact,
      estimate_type,
      dated_on,
      currency,
      reference,
      payment_terms_in_days,
      comments,
      estimate_items,
    }) => {
      logToolCall("freeagent_create_estimate", { contact, estimate_type, dated_on, currency });
      try {
        const estimate: Record<string, unknown> = {
          contact,
          estimate_type,
          dated_on,
          currency,
        };
        if (reference !== undefined) estimate.reference = reference;
        if (payment_terms_in_days !== undefined) estimate.payment_terms_in_days = payment_terms_in_days;
        if (comments !== undefined) estimate.comments = comments;
        if (estimate_items !== undefined) estimate.estimate_items = JSON.parse(estimate_items);

        const data = await client.postJson("/estimates", { estimate });
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Update estimate
  server.tool(
    "freeagent_update_estimate",
    "Update an existing estimate in FreeAgent",
    {
      estimate_id: z.string().describe("The estimate ID"),
      dated_on: z.string().optional().describe("Estimate date (YYYY-MM-DD)"),
      payment_terms_in_days: z
        .number()
        .optional()
        .describe("Payment terms in days"),
      reference: z.string().optional().describe("Estimate reference"),
      comments: z.string().optional().describe("Comments on the estimate"),
    },
    async ({ estimate_id, ...rest }) => {
      logToolCall("freeagent_update_estimate", { estimate_id, ...rest });
      try {
        const estimate: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rest)) {
          if (v !== undefined) estimate[k] = v;
        }
        const data = await client.putJson(`/estimates/${estimate_id}`, { estimate });
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Delete estimate
  server.tool(
    "freeagent_delete_estimate",
    "Delete an estimate from FreeAgent",
    {
      estimate_id: z.string().describe("The estimate ID"),
    },
    async ({ estimate_id }) => {
      logToolCall("freeagent_delete_estimate", { estimate_id });
      try {
        const data = await client.deleteReq(`/estimates/${estimate_id}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Mark estimate as sent
  server.tool(
    "freeagent_mark_estimate_as_sent",
    "Mark an estimate as sent in FreeAgent",
    {
      estimate_id: z.string().describe("The estimate ID"),
    },
    async ({ estimate_id }) => {
      logToolCall("freeagent_mark_estimate_as_sent", { estimate_id });
      try {
        const data = await client.putJson(
          `/estimates/${estimate_id}/transitions/mark_as_sent`,
          {}
        );
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Mark estimate as approved
  server.tool(
    "freeagent_mark_estimate_as_approved",
    "Mark an estimate as approved in FreeAgent",
    {
      estimate_id: z.string().describe("The estimate ID"),
    },
    async ({ estimate_id }) => {
      logToolCall("freeagent_mark_estimate_as_approved", { estimate_id });
      try {
        const data = await client.putJson(
          `/estimates/${estimate_id}/transitions/mark_as_approved`,
          {}
        );
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
