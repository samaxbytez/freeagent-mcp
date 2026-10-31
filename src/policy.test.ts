import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FreeAgentClient } from "./client.js";
import { withToolPolicy, annotationsFor, SENSITIVE_TOOLS } from "./policy.js";
import { registerUserTools } from "./tools/users.js";
import { registerInvoiceTools } from "./tools/invoices.js";
import { registerCompanyTools } from "./tools/company.js";

function registeredTools(server: McpServer): Record<string, { annotations?: unknown }> {
  return (server as unknown as { _registeredTools: Record<string, { annotations?: unknown }> })
    ._registeredTools;
}

function setup(allowSensitive: boolean) {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  const client = {} as FreeAgentClient;
  const tools = withToolPolicy(server, { allowSensitive });
  registerUserTools(tools, client);
  registerInvoiceTools(tools, client);
  registerCompanyTools(tools, client);
  return registeredTools(server);
}

describe("withToolPolicy", () => {
  it("drops sensitive tools by default", () => {
    const tools = setup(false);
    for (const name of SENSITIVE_TOOLS) {
      expect(tools[name]).toBeUndefined();
    }
    expect(tools["freeagent_list_users"]).toBeDefined();
    expect(tools["freeagent_create_invoice"]).toBeDefined();
  });

  it("keeps sensitive tools when opted in", () => {
    const tools = setup(true);
    for (const name of SENSITIVE_TOOLS) {
      expect(tools[name]).toBeDefined();
    }
  });

  it("annotates tools registered via both tool() and registerTool()", () => {
    const tools = setup(false);
    expect(tools["freeagent_list_invoices"].annotations).toEqual({
      readOnlyHint: true,
      openWorldHint: false,
    });
    expect(tools["freeagent_get_company"].annotations).toEqual({
      readOnlyHint: true,
      openWorldHint: false,
    });
    expect(tools["freeagent_delete_invoice"].annotations).toMatchObject({
      destructiveHint: true,
    });
  });
});

describe("annotationsFor", () => {
  it("classifies tools by action", () => {
    expect(annotationsFor("freeagent_get_bank_account").readOnlyHint).toBe(true);
    expect(annotationsFor("freeagent_create_contact")).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
    });
    expect(annotationsFor("freeagent_update_contact").destructiveHint).toBe(true);
    expect(annotationsFor("freeagent_mark_invoice_as_cancelled").destructiveHint).toBe(true);
    expect(annotationsFor("freeagent_send_invoice_email").openWorldHint).toBe(true);
  });
});
