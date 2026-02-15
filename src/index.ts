#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FreeAgentClient } from "./client.js";
import { registerCompanyTools } from "./tools/company.js";
import { registerUserTools } from "./tools/users.js";
import { registerContactTools } from "./tools/contacts.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerTimeslipTools } from "./tools/timeslips.js";
import { registerInvoiceTools } from "./tools/invoices.js";
import { registerEstimateTools } from "./tools/estimates.js";
import { registerBillTools } from "./tools/bills.js";
import { registerCreditNoteTools } from "./tools/credit-notes.js";
import { registerExpenseTools } from "./tools/expenses.js";
import { registerBankingTools } from "./tools/banking.js";
import { registerCategoryTools } from "./tools/categories.js";
import { registerAccountingTools } from "./tools/accounting.js";

const FREEAGENT_ACCESS_TOKEN = process.env.FREEAGENT_ACCESS_TOKEN;
const FREEAGENT_BASE_URL = process.env.FREEAGENT_BASE_URL;

if (!FREEAGENT_ACCESS_TOKEN) {
  console.error("Missing required environment variable: FREEAGENT_ACCESS_TOKEN");
  process.exit(1);
}

const client = new FreeAgentClient(FREEAGENT_ACCESS_TOKEN, FREEAGENT_BASE_URL);

const server = new McpServer({
  name: "freeagent-mcp",
  version: "1.0.0",
});

registerCompanyTools(server, client);
registerUserTools(server, client);
registerContactTools(server, client);
registerProjectTools(server, client);
registerTaskTools(server, client);
registerTimeslipTools(server, client);
registerInvoiceTools(server, client);
registerEstimateTools(server, client);
registerBillTools(server, client);
registerCreditNoteTools(server, client);
registerExpenseTools(server, client);
registerBankingTools(server, client);
registerCategoryTools(server, client);
registerAccountingTools(server, client);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("FreeAgent MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
