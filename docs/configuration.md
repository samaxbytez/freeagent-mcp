# Configuration

Setting up for the first time? Follow [setup.md](setup.md) instead: this page is
the reference.

## Installing

Node.js 24 or later. Your MCP client normally starts the server with `npx`, so
there's nothing to install:

```bash
npx freeagent-mcp-server
```

Or install it globally:

```bash
npm install -g freeagent-mcp-server
freeagent-mcp
```

To pin a specific version, append `@<version>` (e.g. `npm install -g freeagent-mcp-server@3.0.0`).

Or build from source:

```bash
git clone https://github.com/samaxbytez/freeagent-mcp.git
cd freeagent-mcp
npm install
npm run build
npm start
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FREEAGENT_CLIENT_ID` | Yes* | OAuth2 client ID from Developer Dashboard |
| `FREEAGENT_CLIENT_SECRET` | Yes* | OAuth2 client secret from Developer Dashboard |
| `FREEAGENT_SANDBOX` | No | Set to `true` for sandbox (defaults to production) |
| `FREEAGENT_ACCESS_TOKEN` | No | Legacy: direct access token (skips stored token flow) |
| `FREEAGENT_BASE_URL` | No | Override API base URL |
| `FREEAGENT_ENABLE_SENSITIVE_TOOLS` | No | Set to `true` to register the [sensitive tools](security.md#sensitive-tools) |
| `FREEAGENT_ATTACHMENTS_DIR` | For attachments | Directory `attachment_path` may read from. Required to use attachments at all (see [security.md](security.md#attachments)) |

*Not required if using `FREEAGENT_ACCESS_TOKEN` directly.

## Authentication

```bash
npx freeagent-mcp-server auth
```

This opens your browser to authorize the app. The auth flow supports two modes:

- **Automatic** (default) - A local server on port 3456 catches the OAuth redirect automatically. This is seamless when the port is available and the redirect URI is configured.
- **Manual paste fallback** - If the redirect doesn't work (port busy, firewall, etc.), simply copy the full URL from your browser's address bar and paste it into the terminal. The URL will look like `http://localhost:3456/callback?code=...&state=...`.

After approval, tokens are saved to `~/.freeagent-mcp/tokens.json` and automatically refreshed when they expire.

Pasting needs an interactive terminal: run `auth` in a normal terminal tab, not
through a tool that gives the command no keyboard input. The callback server
listens on `127.0.0.1` only.

Sandbox tokens are kept separately, in `~/.freeagent-mcp/tokens.sandbox.json`, so
you can be signed in to both and switch with `FREEAGENT_SANDBOX` alone.

## Sandbox

By default the server connects to the FreeAgent production API. Set
`FREEAGENT_SANDBOX=true` to use the sandbox, for both `auth` and the server.

## MCP clients

Any app that can start a local MCP server works. Each one takes the same three
things in its own config format: the command `npx`, the arguments
`-y freeagent-mcp-server`, and your `FREEAGENT_*` environment variables. Restart
the app after editing its config.

### Claude Desktop / Cowork

Add to your `claude_desktop_config.json`:

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

This works with both Claude Desktop chat and Claude Cowork. Make sure to run `npx freeagent-mcp-server auth` in your terminal first to complete the one-time OAuth setup.

### Claude Code

Add to your `.mcp.json`:

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

### Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.freeagent]
command = "npx"
args = ["-y", "freeagent-mcp-server"]
env = { FREEAGENT_CLIENT_ID = "your_client_id", FREEAGENT_CLIENT_SECRET = "your_client_secret" }
```

### Cursor

Add the same `mcpServers` block as Claude Desktop to `~/.cursor/mcp.json` (all
projects) or `.cursor/mcp.json` (one project).

### Windsurf

Add the same `mcpServers` block to `~/.codeium/windsurf/mcp_config.json`.

### Gemini CLI

Add the same `mcpServers` block to `~/.gemini/settings.json`, alongside any
settings already there.

### VS Code (GitHub Copilot agent mode)

Add to `.vscode/mcp.json`. VS Code uses `servers` rather than `mcpServers`, and
can prompt for the secret instead of storing it in the file:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "freeagent-secret",
      "description": "FreeAgent OAuth secret",
      "password": true
    }
  ],
  "servers": {
    "freeagent": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "freeagent-mcp-server"],
      "env": {
        "FREEAGENT_CLIENT_ID": "your_client_id",
        "FREEAGENT_CLIENT_SECRET": "${input:freeagent-secret}"
      }
    }
  }
}
```

### Keep the secret out of git

A project-level file (`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`) sits
in your repository. Prefer the user-level file, or VS Code's prompt above, so the
client secret is never committed. Whichever client you use, run
`npx freeagent-mcp-server auth` once in a terminal first: every client shares the
same saved sign-in.

### ChatGPT and Grok

Not supported yet. This server runs on your computer and talks to its client
over stdio; ChatGPT's connectors and xAI's Grok only connect to MCP servers
hosted on the internet over HTTPS. Using it from them would need an HTTP
transport, hosting and per-user sign-in on the server.
