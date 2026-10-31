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

To pin a specific version, append `@<version>` (e.g. `npm install -g freeagent-mcp-server@2.0.1`).

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
