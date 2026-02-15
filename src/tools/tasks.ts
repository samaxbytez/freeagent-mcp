import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FreeAgentClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall, buildParams } from "../utils.js";

export function registerTaskTools(server: McpServer, client: FreeAgentClient): void {
  // List tasks
  server.registerTool(
    "freeagent_list_tasks",
    {
      title: "List Tasks",
      description:
        "List tasks from FreeAgent. Optionally filter by view, project, or updated_since.",
      inputSchema: {
        view: z
          .enum(["all", "active", "completed", "hidden"])
          .optional()
          .describe("Filter tasks by view: all, active, completed, or hidden"),
        sort: z.string().optional().describe("Sort order for tasks"),
        project: z
          .string()
          .optional()
          .describe("Project URL to filter tasks by"),
        updated_since: z
          .string()
          .optional()
          .describe("Only return tasks updated since this date (ISO 8601)"),
      },
    },
    async ({ view, sort, project, updated_since }) => {
      logToolCall("freeagent_list_tasks", { view, sort, project, updated_since });
      try {
        const params = buildParams({ view, sort, project, updated_since });
        const response = await client.get("/tasks", params);
        return jsonResponse(response);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Get task
  server.registerTool(
    "freeagent_get_task",
    {
      title: "Get Task",
      description: "Get a specific task by ID from FreeAgent.",
      inputSchema: {
        task_id: z.string().describe("The ID of the task to retrieve"),
      },
    },
    async ({ task_id }) => {
      logToolCall("freeagent_get_task", { task_id });
      try {
        const response = await client.get(`/tasks/${task_id}`);
        return jsonResponse(response);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Create task
  server.registerTool(
    "freeagent_create_task",
    {
      title: "Create Task",
      description:
        "Create a new task in FreeAgent. The project URL is required and passed as a query parameter.",
      inputSchema: {
        project: z
          .string()
          .describe("Project URL to create the task under (passed as query parameter)"),
        name: z.string().describe("Name of the task"),
        is_billable: z
          .boolean()
          .optional()
          .describe("Whether the task is billable"),
        billing_rate: z
          .string()
          .optional()
          .describe("Billing rate for the task"),
        billing_period: z
          .enum(["hour", "day", "week", "month", "year"])
          .optional()
          .describe("Billing period: hour, day, week, month, or year"),
        status: z
          .enum(["Active", "Completed", "Hidden"])
          .optional()
          .describe("Task status: Active, Completed, or Hidden"),
      },
    },
    async ({ project, name, is_billable, billing_rate, billing_period, status }) => {
      logToolCall("freeagent_create_task", { project, name, status });
      try {
        const body: Record<string, unknown> = { name };
        if (is_billable !== undefined) body.is_billable = is_billable;
        if (billing_rate !== undefined) body.billing_rate = billing_rate;
        if (billing_period !== undefined) body.billing_period = billing_period;
        if (status !== undefined) body.status = status;

        const response = await client.postJson(
          `/tasks?project=${encodeURIComponent(project)}`,
          { task: body }
        );
        return jsonResponse(response);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Update task
  server.registerTool(
    "freeagent_update_task",
    {
      title: "Update Task",
      description: "Update an existing task in FreeAgent.",
      inputSchema: {
        task_id: z.string().describe("The ID of the task to update"),
        name: z.string().optional().describe("Name of the task"),
        is_billable: z
          .boolean()
          .optional()
          .describe("Whether the task is billable"),
        billing_rate: z
          .string()
          .optional()
          .describe("Billing rate for the task"),
        billing_period: z
          .enum(["hour", "day", "week", "month", "year"])
          .optional()
          .describe("Billing period: hour, day, week, month, or year"),
        status: z
          .enum(["Active", "Completed", "Hidden"])
          .optional()
          .describe("Task status: Active, Completed, or Hidden"),
      },
    },
    async ({ task_id, name, is_billable, billing_rate, billing_period, status }) => {
      logToolCall("freeagent_update_task", { task_id, name, status });
      try {
        const body: Record<string, unknown> = {};
        if (name !== undefined) body.name = name;
        if (is_billable !== undefined) body.is_billable = is_billable;
        if (billing_rate !== undefined) body.billing_rate = billing_rate;
        if (billing_period !== undefined) body.billing_period = billing_period;
        if (status !== undefined) body.status = status;

        const response = await client.putJson(`/tasks/${task_id}`, { task: body });
        return jsonResponse(response);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Delete task
  server.registerTool(
    "freeagent_delete_task",
    {
      title: "Delete Task",
      description: "Delete a task from FreeAgent.",
      inputSchema: {
        task_id: z.string().describe("The ID of the task to delete"),
      },
    },
    async ({ task_id }) => {
      logToolCall("freeagent_delete_task", { task_id });
      try {
        const response = await client.deleteReq(`/tasks/${task_id}`);
        return jsonResponse(response);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
