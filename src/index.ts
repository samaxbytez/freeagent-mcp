#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FreeAgentClient } from "./client.js";
import { runAuthFlow, getValidAccessToken, getApiBase } from "./auth.js";
import type { OAuthConfig } from "./auth.js";
import { withToolPolicy } from "./policy.js";
import { createRequire } from "node:module";
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
const FREEAGENT_CLIENT_ID = process.env.FREEAGENT_CLIENT_ID;
const FREEAGENT_CLIENT_SECRET = process.env.FREEAGENT_CLIENT_SECRET;
const FREEAGENT_SANDBOX = process.env.FREEAGENT_SANDBOX === "true";
const FREEAGENT_BASE_URL = process.env.FREEAGENT_BASE_URL;
const FREEAGENT_ENABLE_SENSITIVE_TOOLS =
  process.env.FREEAGENT_ENABLE_SENSITIVE_TOOLS === "true";

function buildOAuthConfig(): OAuthConfig | null {
  if (FREEAGENT_CLIENT_ID && FREEAGENT_CLIENT_SECRET) {
    return {
      clientId: FREEAGENT_CLIENT_ID,
      clientSecret: FREEAGENT_CLIENT_SECRET,
      sandbox: FREEAGENT_SANDBOX,
    };
  }
  return null;
}

// Handle `npx freeagent-mcp-server auth` subcommand
if (process.argv[2] === "auth") {
  const config = buildOAuthConfig();
  if (!config) {
    console.error(
      "Missing FREEAGENT_CLIENT_ID and FREEAGENT_CLIENT_SECRET environment variables.\n" +
        "Set these from your FreeAgent Developer Dashboard app credentials."
    );
    process.exit(1);
  }
  runAuthFlow(config)
    .then(() => {
      console.log("Authentication complete! Tokens saved.");
      console.log("You can now start the MCP server.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Authentication failed:", err.message);
      process.exit(1);
    });
} else {
  // Normal server mode
  let client: FreeAgentClient;

  if (FREEAGENT_ACCESS_TOKEN) {
    // Legacy: direct access token
    client = new FreeAgentClient(
      FREEAGENT_ACCESS_TOKEN,
      FREEAGENT_BASE_URL || getApiBase(FREEAGENT_SANDBOX)
    );
  } else {
    const config = buildOAuthConfig();
    if (!config) {
      console.error(
        "Missing credentials. Provide one of:\n" +
          "  1. FREEAGENT_CLIENT_ID + FREEAGENT_CLIENT_SECRET (recommended)\n" +
          "  2. FREEAGENT_ACCESS_TOKEN (legacy)\n\n" +
          "For option 1, run `npx freeagent-mcp-server auth` first to authenticate."
      );
      process.exit(1);
    }
    const baseUrl = FREEAGENT_BASE_URL || getApiBase(config.sandbox);
    client = new FreeAgentClient(
      () => getValidAccessToken(config),
      baseUrl
    );
  }

  // package.json sits one level above build/ (and src/), in the published
  // package too, so the server reports the version actually installed.
  const { version } = createRequire(import.meta.url)("../package.json") as {
    version: string;
  };
  const server = new McpServer({ name: "freeagent-mcp", version });
  const tools = withToolPolicy(server, {
    allowSensitive: FREEAGENT_ENABLE_SENSITIVE_TOOLS,
  });

  registerCompanyTools(tools, client);
  registerUserTools(tools, client);
  registerContactTools(tools, client);
  registerProjectTools(tools, client);
  registerTaskTools(tools, client);
  registerTimeslipTools(tools, client);
  registerInvoiceTools(tools, client);
  registerEstimateTools(tools, client);
  registerBillTools(tools, client);
  registerCreditNoteTools(tools, client);
  registerExpenseTools(tools, client);
  registerBankingTools(tools, client);
  registerCategoryTools(tools, client);
  registerAccountingTools(tools, client);

  async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("FreeAgent MCP Server running on stdio");
  }

  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
