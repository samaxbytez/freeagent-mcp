import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FreeAgentClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall, buildParams } from "../utils.js";

export function registerContactTools(server: McpServer, client: FreeAgentClient): void {
  server.tool(
    "freeagent_list_contacts",
    "List contacts from FreeAgent with optional filtering and sorting",
    {
      view: z
        .enum([
          "all",
          "active",
          "clients",
          "suppliers",
          "active_projects",
          "completed_projects",
          "open_clients",
          "open_suppliers",
          "hidden",
        ])
        .optional()
        .describe("Filter contacts by view"),
      sort: z
        .string()
        .optional()
        .describe('Sort order, e.g. "name" or "-updated_at"'),
      updated_since: z
        .string()
        .optional()
        .describe("Only return contacts updated since this ISO 8601 date"),
    },
    async ({ view, sort, updated_since }) => {
      logToolCall("freeagent_list_contacts", { view, sort, updated_since });
      try {
        const params = buildParams({ view, sort, updated_since });
        const data = await client.get("/contacts", params);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_get_contact",
    "Get a single contact from FreeAgent by ID",
    {
      contact_id: z.string().describe("The ID of the contact to retrieve"),
    },
    async ({ contact_id }) => {
      logToolCall("freeagent_get_contact", { contact_id });
      try {
        const data = await client.get(`/contacts/${contact_id}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_create_contact",
    "Create a new contact in FreeAgent. Must provide either first_name and last_name, or organisation_name.",
    {
      first_name: z.string().optional().describe("Contact first name"),
      last_name: z.string().optional().describe("Contact last name"),
      organisation_name: z.string().optional().describe("Organisation name"),
      email: z.string().optional().describe("Contact email address"),
      phone_number: z.string().optional().describe("Contact phone number"),
      address1: z.string().optional().describe("Address line 1"),
      address2: z.string().optional().describe("Address line 2"),
      address3: z.string().optional().describe("Address line 3"),
      town: z.string().optional().describe("Town or city"),
      postcode: z.string().optional().describe("Postal code"),
      country: z.string().optional().describe("Country"),
      default_payment_terms_in_days: z
        .number()
        .optional()
        .describe("Default payment terms in days"),
    },
    async ({
      first_name,
      last_name,
      organisation_name,
      email,
      phone_number,
      address1,
      address2,
      address3,
      town,
      postcode,
      country,
      default_payment_terms_in_days,
    }) => {
      logToolCall("freeagent_create_contact", {
        first_name,
        last_name,
        organisation_name,
        email,
      });
      try {
        const contact: Record<string, unknown> = {};
        if (first_name !== undefined) contact.first_name = first_name;
        if (last_name !== undefined) contact.last_name = last_name;
        if (organisation_name !== undefined) contact.organisation_name = organisation_name;
        if (email !== undefined) contact.email = email;
        if (phone_number !== undefined) contact.phone_number = phone_number;
        if (address1 !== undefined) contact.address1 = address1;
        if (address2 !== undefined) contact.address2 = address2;
        if (address3 !== undefined) contact.address3 = address3;
        if (town !== undefined) contact.town = town;
        if (postcode !== undefined) contact.postcode = postcode;
        if (country !== undefined) contact.country = country;
        if (default_payment_terms_in_days !== undefined)
          contact.default_payment_terms_in_days = default_payment_terms_in_days;

        const data = await client.postJson("/contacts", { contact });
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_update_contact",
    "Update an existing contact in FreeAgent",
    {
      contact_id: z.string().describe("The ID of the contact to update"),
      first_name: z.string().optional().describe("Contact first name"),
      last_name: z.string().optional().describe("Contact last name"),
      organisation_name: z.string().optional().describe("Organisation name"),
      email: z.string().optional().describe("Contact email address"),
      phone_number: z.string().optional().describe("Contact phone number"),
      address1: z.string().optional().describe("Address line 1"),
      address2: z.string().optional().describe("Address line 2"),
      address3: z.string().optional().describe("Address line 3"),
      town: z.string().optional().describe("Town or city"),
      postcode: z.string().optional().describe("Postal code"),
      country: z.string().optional().describe("Country"),
      default_payment_terms_in_days: z
        .number()
        .optional()
        .describe("Default payment terms in days"),
    },
    async ({
      contact_id,
      first_name,
      last_name,
      organisation_name,
      email,
      phone_number,
      address1,
      address2,
      address3,
      town,
      postcode,
      country,
      default_payment_terms_in_days,
    }) => {
      logToolCall("freeagent_update_contact", { contact_id });
      try {
        const contact: Record<string, unknown> = {};
        if (first_name !== undefined) contact.first_name = first_name;
        if (last_name !== undefined) contact.last_name = last_name;
        if (organisation_name !== undefined) contact.organisation_name = organisation_name;
        if (email !== undefined) contact.email = email;
        if (phone_number !== undefined) contact.phone_number = phone_number;
        if (address1 !== undefined) contact.address1 = address1;
        if (address2 !== undefined) contact.address2 = address2;
        if (address3 !== undefined) contact.address3 = address3;
        if (town !== undefined) contact.town = town;
        if (postcode !== undefined) contact.postcode = postcode;
        if (country !== undefined) contact.country = country;
        if (default_payment_terms_in_days !== undefined)
          contact.default_payment_terms_in_days = default_payment_terms_in_days;

        const data = await client.putJson(`/contacts/${contact_id}`, { contact });
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_delete_contact",
    "Delete a contact from FreeAgent",
    {
      contact_id: z.string().describe("The ID of the contact to delete"),
    },
    async ({ contact_id }) => {
      logToolCall("freeagent_delete_contact", { contact_id });
      try {
        const data = await client.deleteReq(`/contacts/${contact_id}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
