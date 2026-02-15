import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FreeAgentClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall, buildParams } from "../utils.js";

export function registerProjectTools(server: McpServer, client: FreeAgentClient): void {
  // List projects
  server.tool(
    "freeagent_list_projects",
    "List projects from FreeAgent, optionally filtered by view, sort order, or contact",
    {
      view: z.enum(["active", "completed", "cancelled", "hidden"]).optional().describe("Filter projects by status view"),
      sort: z.string().optional().describe("Sort order for results"),
      contact: z.string().optional().describe("Filter by contact URL"),
    },
    async ({ view, sort, contact }) => {
      logToolCall("freeagent_list_projects", { view, sort, contact });
      try {
        const params = buildParams({ view, sort, contact });
        const data = await client.get("/projects", params);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Get project
  server.tool(
    "freeagent_get_project",
    "Get a single project from FreeAgent by ID",
    {
      project_id: z.string().describe("The project ID"),
    },
    async ({ project_id }) => {
      logToolCall("freeagent_get_project", { project_id });
      try {
        const data = await client.get(`/projects/${project_id}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Create project
  server.tool(
    "freeagent_create_project",
    "Create a new project in FreeAgent",
    {
      contact: z.string().describe("Contact URL"),
      name: z.string().describe("Project name"),
      status: z.enum(["Active", "Completed", "Cancelled", "Hidden"]).describe("Project status"),
      budget: z.number().describe("Project budget"),
      budget_units: z.enum(["Hours", "Days", "Monetary"]).describe("Budget units"),
      currency: z.string().describe("Currency code"),
      normal_billing_rate: z.string().optional().describe("Normal billing rate"),
      hours_per_day: z.string().optional().describe("Hours per day"),
      billing_period: z.enum(["hour", "day", "week", "month", "year"]).optional().describe("Billing period"),
      is_ir35: z.boolean().optional().describe("Whether the project is IR35"),
      starts_on: z.string().optional().describe("Project start date (YYYY-MM-DD)"),
      ends_on: z.string().optional().describe("Project end date (YYYY-MM-DD)"),
      uses_project_invoice_sequence: z.boolean().optional().describe("Whether to use project invoice sequence"),
    },
    async (params) => {
      logToolCall("freeagent_create_project", params);
      try {
        const project: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined) project[k] = v;
        }
        const data = await client.postJson("/projects", { project });
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Update project
  server.tool(
    "freeagent_update_project",
    "Update an existing project in FreeAgent",
    {
      project_id: z.string().describe("The project ID"),
      name: z.string().optional().describe("Project name"),
      status: z.enum(["Active", "Completed", "Cancelled", "Hidden"]).optional().describe("Project status"),
      budget: z.number().optional().describe("Project budget"),
      budget_units: z.enum(["Hours", "Days", "Monetary"]).optional().describe("Budget units"),
      currency: z.string().optional().describe("Currency code"),
      normal_billing_rate: z.string().optional().describe("Normal billing rate"),
      hours_per_day: z.string().optional().describe("Hours per day"),
      billing_period: z.enum(["hour", "day", "week", "month", "year"]).optional().describe("Billing period"),
      is_ir35: z.boolean().optional().describe("Whether the project is IR35"),
      starts_on: z.string().optional().describe("Project start date (YYYY-MM-DD)"),
      ends_on: z.string().optional().describe("Project end date (YYYY-MM-DD)"),
      uses_project_invoice_sequence: z.boolean().optional().describe("Whether to use project invoice sequence"),
    },
    async ({ project_id, ...rest }) => {
      logToolCall("freeagent_update_project", { project_id, ...rest });
      try {
        const project: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rest)) {
          if (v !== undefined) project[k] = v;
        }
        const data = await client.putJson(`/projects/${project_id}`, { project });
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Delete project
  server.tool(
    "freeagent_delete_project",
    "Delete a project from FreeAgent",
    {
      project_id: z.string().describe("The project ID"),
    },
    async ({ project_id }) => {
      logToolCall("freeagent_delete_project", { project_id });
      try {
        const data = await client.deleteReq(`/projects/${project_id}`);
        return jsonResponse(data);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
