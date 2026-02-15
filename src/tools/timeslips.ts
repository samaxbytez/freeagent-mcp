import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FreeAgentClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall, buildParams } from "../utils.js";

export function registerTimeslipTools(
  server: McpServer,
  client: FreeAgentClient
): void {
  // List timeslips
  server.registerTool(
    "freeagent_list_timeslips",
    {
      title: "List Timeslips",
      description:
        "List timeslips from FreeAgent. Can be filtered by date range, user, task, project, and billing status.",
      inputSchema: {
        from_date: z
          .string()
          .optional()
          .describe("Start date filter (YYYY-MM-DD)"),
        to_date: z
          .string()
          .optional()
          .describe("End date filter (YYYY-MM-DD)"),
        updated_since: z
          .string()
          .optional()
          .describe("Only return timeslips updated since this timestamp"),
        view: z
          .enum(["all", "unbilled", "running"])
          .optional()
          .describe("Filter by billing/running status"),
        user: z
          .string()
          .optional()
          .describe("Filter by user URL"),
        task: z
          .string()
          .optional()
          .describe("Filter by task URL"),
        project: z
          .string()
          .optional()
          .describe("Filter by project URL"),
      },
    },
    async (args) => {
      logToolCall("freeagent_list_timeslips", args);
      try {
        const params = buildParams({
          from_date: args.from_date,
          to_date: args.to_date,
          updated_since: args.updated_since,
          view: args.view,
          user: args.user,
          task: args.task,
          project: args.project,
        });
        const response = await client.get("/timeslips", params);
        return jsonResponse(response);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Get timeslip
  server.registerTool(
    "freeagent_get_timeslip",
    {
      title: "Get Timeslip",
      description: "Get a single timeslip by its ID.",
      inputSchema: {
        timeslip_id: z.string().describe("The timeslip ID"),
      },
    },
    async (args) => {
      logToolCall("freeagent_get_timeslip", args);
      try {
        const response = await client.get(`/timeslips/${args.timeslip_id}`);
        return jsonResponse(response);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Create timeslip
  server.registerTool(
    "freeagent_create_timeslip",
    {
      title: "Create Timeslip",
      description:
        "Create a new timeslip in FreeAgent for tracking time against a project task.",
      inputSchema: {
        user: z.string().describe("User URL"),
        project: z.string().describe("Project URL"),
        task: z.string().describe("Task URL"),
        dated_on: z.string().describe("Date for the timeslip (YYYY-MM-DD)"),
        hours: z.string().describe("Number of hours as a decimal string"),
        comment: z.string().optional().describe("Optional comment for the timeslip"),
      },
    },
    async (args) => {
      logToolCall("freeagent_create_timeslip", args);
      try {
        const timeslip: Record<string, unknown> = {
          user: args.user,
          project: args.project,
          task: args.task,
          dated_on: args.dated_on,
          hours: args.hours,
        };
        if (args.comment !== undefined) {
          timeslip.comment = args.comment;
        }
        const response = await client.postJson("/timeslips", { timeslip });
        return jsonResponse(response);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Update timeslip
  server.registerTool(
    "freeagent_update_timeslip",
    {
      title: "Update Timeslip",
      description: "Update an existing timeslip in FreeAgent.",
      inputSchema: {
        timeslip_id: z.string().describe("The timeslip ID"),
        dated_on: z
          .string()
          .optional()
          .describe("Date for the timeslip (YYYY-MM-DD)"),
        hours: z
          .string()
          .optional()
          .describe("Number of hours as a decimal string"),
        comment: z.string().optional().describe("Comment for the timeslip"),
        task: z.string().optional().describe("Task URL"),
      },
    },
    async (args) => {
      logToolCall("freeagent_update_timeslip", args);
      try {
        const timeslip: Record<string, unknown> = {};
        if (args.dated_on !== undefined) timeslip.dated_on = args.dated_on;
        if (args.hours !== undefined) timeslip.hours = args.hours;
        if (args.comment !== undefined) timeslip.comment = args.comment;
        if (args.task !== undefined) timeslip.task = args.task;
        const response = await client.putJson(
          `/timeslips/${args.timeslip_id}`,
          { timeslip }
        );
        return jsonResponse(response);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Delete timeslip
  server.registerTool(
    "freeagent_delete_timeslip",
    {
      title: "Delete Timeslip",
      description: "Delete a timeslip from FreeAgent.",
      inputSchema: {
        timeslip_id: z.string().describe("The timeslip ID"),
      },
    },
    async (args) => {
      logToolCall("freeagent_delete_timeslip", args);
      try {
        const response = await client.deleteReq(
          `/timeslips/${args.timeslip_id}`
        );
        return jsonResponse(response);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Start timer
  server.registerTool(
    "freeagent_start_timer",
    {
      title: "Start Timer",
      description:
        "Start a running timer on a timeslip. The timeslip will accumulate time until the timer is stopped.",
      inputSchema: {
        timeslip_id: z.string().describe("The timeslip ID"),
      },
    },
    async (args) => {
      logToolCall("freeagent_start_timer", args);
      try {
        const response = await client.postJson(
          `/timeslips/${args.timeslip_id}/timer`,
          {}
        );
        return jsonResponse(response);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  // Stop timer
  server.registerTool(
    "freeagent_stop_timer",
    {
      title: "Stop Timer",
      description: "Stop a running timer on a timeslip.",
      inputSchema: {
        timeslip_id: z.string().describe("The timeslip ID"),
      },
    },
    async (args) => {
      logToolCall("freeagent_stop_timer", args);
      try {
        const response = await client.deleteReq(
          `/timeslips/${args.timeslip_id}/timer`
        );
        return jsonResponse(response);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
