# freeagent-mcp-server

[![CI](https://github.com/samaxbytez/freeagent-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/samaxbytez/freeagent-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/freeagent-mcp-server.svg)](https://www.npmjs.com/package/freeagent-mcp-server)
![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-5FA04E?logo=nodedotjs&logoColor=white)
![MCP SDK 1.32](https://img.shields.io/badge/MCP_SDK-1.32-555555)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<!-- The Node.js and MCP SDK badges are static: change them with package.json's engines and @modelcontextprotocol/sdk. -->

An [MCP](https://modelcontextprotocol.io) server that gives Claude, Codex, Cursor,
VS Code, Gemini CLI or any other MCP client the
[FreeAgent](https://www.freeagent.com/) accounting API: 76 tools for
invoices, expenses, bills, contacts, projects, timeslips, banking, estimates,
credit notes and the accounting reports.

Text that comes back from FreeAgent, such as a bank transaction's reference, can
be written by someone outside your business, so the server assumes it may carry
instructions aimed at the model. Tools that could hand over account access or
send data out of the account are **off by default**, every tool says whether it
reads, writes or deletes, and receipts are only read from one folder you choose.

## Contents

- [How it fits together](#how-it-fits-together)
- [Quick start](#quick-start)
- [What it can do](#what-it-can-do)
- [Settings](#settings)
- [Development](#development)
- [Documentation](#documentation)
- [Links](#links)

## How it fits together

```
Claude, Codex, Cursor, VS Code, … ──stdio──▶ freeagent-mcp-server (Node.js, on your machine)
                                                   ├─ 76 tools; sensitive ones only with FREEAGENT_ENABLE_SENSITIVE_TOOLS
                                                   ├─ OAuth2 tokens in ~/.freeagent-mcp/tokens.json, refreshed automatically
                                                   ├─ receipts read from FREEAGENT_ATTACHMENTS_DIR only
                                                   └──HTTPS, your bearer token──▶ api.freeagent.com/v2 (or the sandbox)
```

The server runs locally, started by your MCP client, and talks to nothing but
FreeAgent's API. That's also why ChatGPT and Grok can't use it yet: they only
connect to MCP servers hosted on the internet
([details](docs/configuration.md#chatgpt-and-grok)).

## Quick start

Node.js 24 or later, and a FreeAgent account. **New to this? Follow the
step-by-step guide: [docs/setup.md](docs/setup.md).**

1. **Get a client ID and secret.** In the
   [FreeAgent Developer Dashboard](https://dev.freeagent.com/), create an app
   with the redirect URI `http://localhost:3456/callback`. Its **OAuth
   identifier** is your client ID and its **OAuth secret** is your client secret.
2. **Connect your FreeAgent account**, once, in a terminal. Your browser opens
   FreeAgent: log in and approve the app.

   ```bash
   export FREEAGENT_CLIENT_ID="your_client_id"
   export FREEAGENT_CLIENT_SECRET="your_client_secret"
   npx freeagent-mcp-server auth
   ```

3. **Add it to Claude**: `claude_desktop_config.json` for Claude Desktop and
   Cowork (on macOS in `~/Library/Application Support/Claude/`), `.mcp.json` for
   Claude Code. Then restart the client. Codex CLI, Cursor, VS Code, Windsurf and
   Gemini CLI take the same command and credentials in their own config file:
   [docs/configuration.md](docs/configuration.md#mcp-clients).

   ```json
   {
     "mcpServers": {
       "freeagent": {
         "command": "npx",
         "args": ["-y", "freeagent-mcp-server"],
         "env": {
           "FREEAGENT_CLIENT_ID": "your_client_id",
           "FREEAGENT_CLIENT_SECRET": "your_client_secret"
         }
       }
     }
   }
   ```

Check it works by asking "Show me my FreeAgent company details", then try "List
all overdue invoices". Every setting, the sandbox, and installing globally or
from source: [docs/configuration.md](docs/configuration.md).

## What it can do

| Area | Tools | |
| --- | --- | --- |
| Company | 3 | Company details, business categories, tax timeline |
| Users | 6 | List and look up users; create, update, delete (sensitive) |
| Contacts | 5 | Clients and suppliers (changing an email is sensitive) |
| Projects, Tasks | 5, 5 | Projects and their billable tasks |
| Timeslips | 7 | Time tracking, with a start/stop timer |
| Invoices | 9 | Create, update, mark sent, draft or cancelled; email (sensitive) |
| Estimates | 7 | Quotes, estimates and proposals, sent and approved |
| Bills | 5 | Supplier bills, with a receipt attached |
| Credit notes | 5 | Credit notes |
| Expenses | 5 | Expenses, with a receipt attached |
| Banking | 7 | Bank accounts and their transactions; create (sensitive) |
| Categories | 2 | The chart of accounts |
| Accounting | 5 | Profit and loss, balance sheet, trial balance |

List tools page through results (`page`, `per_page` up to 100). Every tool, its
endpoint and example prompts: [docs/tools.md](docs/tools.md).

## Settings

| Variable | Required | What |
| --- | --- | --- |
| `FREEAGENT_CLIENT_ID`, `FREEAGENT_CLIENT_SECRET` | Yes | Your app's OAuth2 credentials |
| `FREEAGENT_SANDBOX` | No | `true` to use the FreeAgent sandbox |
| `FREEAGENT_ENABLE_SENSITIVE_TOOLS` | No | `true` to turn on user management, invoice emailing, adding bank accounts and changing a contact's email |
| `FREEAGENT_ATTACHMENTS_DIR` | To attach receipts | The one folder `attachment_path` may read from |
| `FREEAGENT_ACCESS_TOKEN`, `FREEAGENT_BASE_URL` | No | Legacy direct token; API base override |

Why the sensitive tools are off and how attachments are confined:
[docs/security.md](docs/security.md). Something not working:
[docs/troubleshooting.md](docs/troubleshooting.md).

## Development

```bash
npm install
npm run lint && npm run type-check && npm test && npm run build
```

CI runs the same on Node 24 for every pull request (`test (24)`, required on
`main`). Commits and PR titles are conventional (`feat:`, `fix:`, `docs:` and so
on); `main` squash-merges, so the PR title is the commit. Releases are opened by
hand with `/release`, and merging the release PR publishes to npm
([RELEASING.md](RELEASING.md)). [AGENTS.md](AGENTS.md) has the rules that don't
bend; what's where and adding a tool: [docs/development.md](docs/development.md).

## Documentation

The whole map is [docs/README.md](docs/README.md).

| Doc | What |
| --- | --- |
| [docs/setup.md](docs/setup.md) | Step by step: client ID and secret, connecting your account, adding it to your AI app |
| [docs/configuration.md](docs/configuration.md) | Every setting, signing in, the sandbox, config for each MCP client |
| [docs/tools.md](docs/tools.md) | All 76 tools, pagination, annotations, example prompts |
| [docs/security.md](docs/security.md) | The threat model, sensitive tools, attachments, tokens |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Common errors and fixes |
| [docs/development.md](docs/development.md) | Building, testing, what's where, adding a tool |
| [AGENTS.md](AGENTS.md) | How to work here, and the rules that don't bend |
| [RELEASING.md](RELEASING.md) | The release procedure |
| [CHANGELOG.md](CHANGELOG.md) | What changed in each version |

## Links

- [npm package](https://www.npmjs.com/package/freeagent-mcp-server)
- [FreeAgent API docs](https://dev.freeagent.com/docs) and [quick start](https://dev.freeagent.com/docs/quick_start)
- [Issues](https://github.com/samaxbytez/freeagent-mcp/issues)

## License

MIT
