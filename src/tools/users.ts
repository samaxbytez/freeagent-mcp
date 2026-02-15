import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FreeAgentClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall, buildParams } from "../utils.js";

export function registerUserTools(server: McpServer, client: FreeAgentClient): void {
  server.tool(
    "freeagent_list_users",
    "List all users in the FreeAgent account",
    {
      view: z
        .enum(["all", "staff", "active_staff", "advisors", "active_advisors"])
        .optional()
        .describe("Filter users by view type"),
    },
    async ({ view }) => {
      logToolCall("freeagent_list_users", { view });
      try {
        const params = buildParams({ view });
        const data = await client.get("/users", params);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_get_user",
    "Get a specific user by ID",
    {
      user_id: z.string().describe("The ID of the user to retrieve"),
    },
    async ({ user_id }) => {
      logToolCall("freeagent_get_user", { user_id });
      try {
        const data = await client.get(`/users/${user_id}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_get_current_user",
    "Get the currently authenticated user",
    {},
    async () => {
      logToolCall("freeagent_get_current_user");
      try {
        const data = await client.get("/users/me");
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_create_user",
    "Create a new user in the FreeAgent account",
    {
      email: z.string().describe("Email address for the new user"),
      first_name: z.string().describe("First name of the user"),
      last_name: z.string().describe("Last name of the user"),
      role: z
        .enum([
          "Owner",
          "Director",
          "Partner",
          "Company Secretary",
          "Employee",
          "Shareholder",
          "Accountant",
        ])
        .describe("Role of the user in the company"),
      permission_level: z
        .number()
        .min(0)
        .max(8)
        .optional()
        .describe("Permission level from 0 (no access) to 8 (full access)"),
    },
    async ({ email, first_name, last_name, role, permission_level }) => {
      logToolCall("freeagent_create_user", { email, first_name, last_name, role, permission_level });
      try {
        const body: Record<string, unknown> = {
          email,
          first_name,
          last_name,
          role,
        };
        if (permission_level !== undefined) {
          body.permission_level = permission_level;
        }
        const data = await client.postJson("/users", { user: body });
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_update_user",
    "Update an existing user",
    {
      user_id: z.string().describe("The ID of the user to update"),
      first_name: z.string().optional().describe("Updated first name"),
      last_name: z.string().optional().describe("Updated last name"),
      role: z
        .enum([
          "Owner",
          "Director",
          "Partner",
          "Company Secretary",
          "Employee",
          "Shareholder",
          "Accountant",
        ])
        .optional()
        .describe("Updated role of the user"),
      permission_level: z
        .number()
        .min(0)
        .max(8)
        .optional()
        .describe("Updated permission level from 0 (no access) to 8 (full access)"),
    },
    async ({ user_id, first_name, last_name, role, permission_level }) => {
      logToolCall("freeagent_update_user", { user_id, first_name, last_name, role, permission_level });
      try {
        const body: Record<string, unknown> = {};
        if (first_name !== undefined) body.first_name = first_name;
        if (last_name !== undefined) body.last_name = last_name;
        if (role !== undefined) body.role = role;
        if (permission_level !== undefined) body.permission_level = permission_level;
        const data = await client.putJson(`/users/${user_id}`, { user: body });
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.tool(
    "freeagent_delete_user",
    "Delete a user from the FreeAgent account",
    {
      user_id: z.string().describe("The ID of the user to delete"),
    },
    async ({ user_id }) => {
      logToolCall("freeagent_delete_user", { user_id });
      try {
        const data = await client.deleteReq(`/users/${user_id}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
