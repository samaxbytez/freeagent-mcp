# freeagent-mcp

[![npm version](https://img.shields.io/npm/v/freeagent-mcp.svg)](https://www.npmjs.com/package/freeagent-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server for the [FreeAgent](https://www.freeagent.com/) accounting API. Provides 76 tools covering invoices, expenses, contacts, projects, timeslips, banking, bills, estimates, credit notes, accounting reports, and more.

## Features

- **Company** - Company info, business categories, tax timeline
- **Users** - List, get, create, update, and delete users
- **Contacts** - Full CRUD for clients and suppliers
- **Projects** - Create and manage projects
- **Tasks** - Manage project tasks with billing rates
- **Timeslips** - Track time with start/stop timer support
- **Invoices** - Create, send, and manage invoices with status transitions
- **Estimates** - Quotes, estimates, and proposals with approval workflows
- **Bills** - Manage supplier bills
- **Credit Notes** - Issue and manage credit notes
- **Expenses** - Track and categorize expenses
- **Banking** - Bank accounts and transaction management
- **Categories** - Browse accounting categories
- **Accounting Reports** - Profit & loss, balance sheet, trial balance

## Prerequisites

You need a FreeAgent account and OAuth2 access token. To get one:

1. Sign up for a [FreeAgent Developer](https://dev.freeagent.com/) account
2. Create a sandbox account for testing
3. Register an application to get OAuth credentials
4. Complete the OAuth2 authorization flow to obtain an access token

See the [FreeAgent API Quick Start](https://dev.freeagent.com/docs/quick_start) for detailed instructions.

## Installation

### Using npx (recommended)

```bash
npx freeagent-mcp-server
```

### Global install

```bash
npm install -g freeagent-mcp-server
freeagent-mcp
```

### Build from source

```bash
git clone https://github.com/samaxbytez/freeagent-mcp.git
cd freeagent-mcp
npm install
npm run build
npm start
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FREEAGENT_ACCESS_TOKEN` | Yes | Your FreeAgent OAuth2 access token |
| `FREEAGENT_BASE_URL` | No | API base URL (defaults to `https://api.sandbox.freeagent.com/v2`) |

For production, set:
```
FREEAGENT_BASE_URL=https://api.freeagent.com/v2
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "freeagent": {
      "command": "npx",
      "args": ["-y", "freeagent-mcp-server"],
      "env": {
        "FREEAGENT_ACCESS_TOKEN": "your_access_token_here"
      }
    }
  }
}
```

### Claude Code

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "freeagent": {
      "command": "npx",
      "args": ["-y", "freeagent-mcp-server"],
      "env": {
        "FREEAGENT_ACCESS_TOKEN": "your_access_token_here"
      }
    }
  }
}
```

## Architecture

```
freeagent-mcp/
├── src/
│   ├── index.ts              # Entry point, server setup
│   ├── client.ts             # FreeAgent API HTTP client
│   ├── utils.ts              # Shared utilities (responses, logging)
│   ├── client.test.ts        # Client tests
│   ├── utils.test.ts         # Utils tests
│   └── tools/
│       ├── company.ts        # Company info tools (3)
│       ├── users.ts          # User management tools (6)
│       ├── contacts.ts       # Contact CRUD tools (5)
│       ├── projects.ts       # Project management tools (5)
│       ├── tasks.ts          # Task management tools (5)
│       ├── timeslips.ts      # Time tracking tools (7)
│       ├── invoices.ts       # Invoice tools (9)
│       ├── estimates.ts      # Estimate tools (7)
│       ├── bills.ts          # Bill management tools (5)
│       ├── credit-notes.ts   # Credit note tools (5)
│       ├── expenses.ts       # Expense tracking tools (5)
│       ├── banking.ts        # Banking tools (7)
│       ├── categories.ts     # Category tools (2)
│       ├── accounting.ts     # Accounting report tools (5)
│       └── tools.test.ts     # Tool handler tests
├── package.json
├── tsconfig.json
└── smithery.yaml
```

## Tools Reference

### Company (3 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `freeagent_get_company` | Get company information | `GET /company` |
| `freeagent_list_business_categories` | List business categories | `GET /company/business_categories` |
| `freeagent_get_tax_timeline` | Get tax timeline | `GET /company/tax_timeline` |

### Users (6 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `freeagent_list_users` | List users with optional view filter | `GET /users` |
| `freeagent_get_user` | Get a specific user | `GET /users/:id` |
| `freeagent_get_current_user` | Get the authenticated user | `GET /users/me` |
| `freeagent_create_user` | Create a new user | `POST /users` |
| `freeagent_update_user` | Update a user | `PUT /users/:id` |
| `freeagent_delete_user` | Delete a user | `DELETE /users/:id` |

### Contacts (5 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `freeagent_list_contacts` | List contacts with filtering and sorting | `GET /contacts` |
| `freeagent_get_contact` | Get a specific contact | `GET /contacts/:id` |
| `freeagent_create_contact` | Create a new contact | `POST /contacts` |
| `freeagent_update_contact` | Update a contact | `PUT /contacts/:id` |
| `freeagent_delete_contact` | Delete a contact | `DELETE /contacts/:id` |

### Projects (5 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `freeagent_list_projects` | List projects with optional view filter | `GET /projects` |
| `freeagent_get_project` | Get a specific project | `GET /projects/:id` |
| `freeagent_create_project` | Create a new project | `POST /projects` |
| `freeagent_update_project` | Update a project | `PUT /projects/:id` |
| `freeagent_delete_project` | Delete a project | `DELETE /projects/:id` |

### Tasks (5 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `freeagent_list_tasks` | List tasks with optional filtering | `GET /tasks` |
| `freeagent_get_task` | Get a specific task | `GET /tasks/:id` |
| `freeagent_create_task` | Create a new task for a project | `POST /tasks` |
| `freeagent_update_task` | Update a task | `PUT /tasks/:id` |
| `freeagent_delete_task` | Delete a task | `DELETE /tasks/:id` |

### Timeslips (7 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `freeagent_list_timeslips` | List timeslips with date and status filters | `GET /timeslips` |
| `freeagent_get_timeslip` | Get a specific timeslip | `GET /timeslips/:id` |
| `freeagent_create_timeslip` | Create a new timeslip | `POST /timeslips` |
| `freeagent_update_timeslip` | Update a timeslip | `PUT /timeslips/:id` |
| `freeagent_delete_timeslip` | Delete a timeslip | `DELETE /timeslips/:id` |
| `freeagent_start_timer` | Start a timer on a timeslip | `POST /timeslips/:id/timer` |
| `freeagent_stop_timer` | Stop a timer on a timeslip | `DELETE /timeslips/:id/timer` |

### Invoices (9 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `freeagent_list_invoices` | List invoices with view and contact filters | `GET /invoices` |
| `freeagent_get_invoice` | Get a specific invoice | `GET /invoices/:id` |
| `freeagent_create_invoice` | Create a new invoice | `POST /invoices` |
| `freeagent_update_invoice` | Update an invoice | `PUT /invoices/:id` |
| `freeagent_delete_invoice` | Delete an invoice | `DELETE /invoices/:id` |
| `freeagent_mark_invoice_as_sent` | Mark invoice as sent | `PUT /invoices/:id/transitions/mark_as_sent` |
| `freeagent_mark_invoice_as_draft` | Mark invoice as draft | `PUT /invoices/:id/transitions/mark_as_draft` |
| `freeagent_mark_invoice_as_cancelled` | Cancel an invoice | `PUT /invoices/:id/transitions/mark_as_cancelled` |
| `freeagent_send_invoice_email` | Email an invoice | `POST /invoices/:id/send_email` |

### Estimates (7 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `freeagent_list_estimates` | List estimates with filters | `GET /estimates` |
| `freeagent_get_estimate` | Get a specific estimate | `GET /estimates/:id` |
| `freeagent_create_estimate` | Create a new estimate | `POST /estimates` |
| `freeagent_update_estimate` | Update an estimate | `PUT /estimates/:id` |
| `freeagent_delete_estimate` | Delete an estimate | `DELETE /estimates/:id` |
| `freeagent_mark_estimate_as_sent` | Mark estimate as sent | `PUT /estimates/:id/transitions/mark_as_sent` |
| `freeagent_mark_estimate_as_approved` | Mark estimate as approved | `PUT /estimates/:id/transitions/mark_as_approved` |

### Bills (5 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `freeagent_list_bills` | List bills with view and date filters | `GET /bills` |
| `freeagent_get_bill` | Get a specific bill | `GET /bills/:id` |
| `freeagent_create_bill` | Create a new bill | `POST /bills` |
| `freeagent_update_bill` | Update a bill | `PUT /bills/:id` |
| `freeagent_delete_bill` | Delete a bill | `DELETE /bills/:id` |

### Credit Notes (5 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `freeagent_list_credit_notes` | List credit notes with filters | `GET /credit_notes` |
| `freeagent_get_credit_note` | Get a specific credit note | `GET /credit_notes/:id` |
| `freeagent_create_credit_note` | Create a new credit note | `POST /credit_notes` |
| `freeagent_update_credit_note` | Update a credit note | `PUT /credit_notes/:id` |
| `freeagent_delete_credit_note` | Delete a credit note | `DELETE /credit_notes/:id` |

### Expenses (5 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `freeagent_list_expenses` | List expenses with date and project filters | `GET /expenses` |
| `freeagent_get_expense` | Get a specific expense | `GET /expenses/:id` |
| `freeagent_create_expense` | Create a new expense | `POST /expenses` |
| `freeagent_update_expense` | Update an expense | `PUT /expenses/:id` |
| `freeagent_delete_expense` | Delete an expense | `DELETE /expenses/:id` |

### Banking (7 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `freeagent_list_bank_accounts` | List bank accounts | `GET /bank_accounts` |
| `freeagent_get_bank_account` | Get a specific bank account | `GET /bank_accounts/:id` |
| `freeagent_create_bank_account` | Create a new bank account | `POST /bank_accounts` |
| `freeagent_update_bank_account` | Update a bank account | `PUT /bank_accounts/:id` |
| `freeagent_delete_bank_account` | Delete a bank account | `DELETE /bank_accounts/:id` |
| `freeagent_list_bank_transactions` | List transactions for a bank account | `GET /bank_transactions` |
| `freeagent_get_bank_transaction` | Get a specific bank transaction | `GET /bank_transactions/:id` |

### Categories (2 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `freeagent_list_categories` | List all accounting categories | `GET /categories` |
| `freeagent_get_category` | Get a specific category by nominal code | `GET /categories/:nominal_code` |

### Accounting Reports (5 tools)

| Tool | Description | API Endpoint |
|------|-------------|-------------|
| `freeagent_get_profit_and_loss` | Get profit and loss summary | `GET /accounting/profit_and_loss/summary` |
| `freeagent_get_balance_sheet` | Get balance sheet | `GET /accounting/balance_sheet` |
| `freeagent_get_opening_balances` | Get opening balances | `GET /accounting/balance_sheet/opening_balances` |
| `freeagent_get_trial_balance` | Get trial balance summary | `GET /accounting/trial_balance/summary` |
| `freeagent_get_trial_balance_opening` | Get trial balance opening balances | `GET /accounting/trial_balance/summary/opening_balances` |

## Example Prompts

- "Show me the company information from FreeAgent"
- "List all active contacts"
- "Create a new invoice for contact 12345 dated today with 30 day payment terms"
- "How much time did I log this week?"
- "Start a timer on timeslip 67890"
- "Show my profit and loss for the current year"
- "List all overdue invoices"
- "Create an expense for lunch at $25 under the entertainment category"
- "What's my current balance sheet?"
- "List all open bills from suppliers"

## Development

```bash
# Install dependencies
npm install

# Type check
npm run type-check

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build
npm run build

# Lint
npm run lint

# Format
npm run format
```

### Adding New Tools

1. Create a new file in `src/tools/` (or add to an existing one)
2. Follow the pattern: export a `registerXxxTools(server, client)` function
3. Register each tool with `server.tool()` or `server.registerTool()`
4. Always use `logToolCall()`, `jsonResponse()`, and `errorResponse()`
5. Import and call the register function in `src/index.ts`
6. Add tests in `src/tools/tools.test.ts`

## Troubleshooting

**"Missing required environment variable: FREEAGENT_ACCESS_TOKEN"**
Set the `FREEAGENT_ACCESS_TOKEN` environment variable with a valid OAuth2 access token.

**401 Unauthorized errors**
Your access token may have expired. FreeAgent OAuth tokens expire - you'll need to refresh your token using the OAuth2 refresh flow.

**"FreeAgent API error (403)"**
Your token may not have the required permission level. Check that your FreeAgent app has the appropriate access scopes.

**Sandbox vs Production**
By default the server connects to the FreeAgent sandbox. Set `FREEAGENT_BASE_URL=https://api.freeagent.com/v2` for production.

**Tool not found**
Ensure you're using the correct tool name with the `freeagent_` prefix (e.g., `freeagent_list_invoices`, not `list_invoices`).

**Empty responses**
Some endpoints return empty responses for successful DELETE operations. This is expected behavior.

## License

MIT
