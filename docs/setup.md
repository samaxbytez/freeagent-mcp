# Setting it up

From nothing to asking Claude about your books, in about ten minutes. You need
Node.js 24 or later and a FreeAgent account.

## 1. Get a client ID and secret

The server talks to FreeAgent as an app you register, so first you need that
app's credentials.

1. Go to the [FreeAgent Developer Dashboard](https://dev.freeagent.com/) and sign
   up, or log in if you already have a developer account.
2. Create a new app. Give it any name (for example "Claude"), and add this
   **redirect URI**, exactly as written:

   ```
   http://localhost:3456/callback
   ```

   FreeAgent only sends you back to a redirect URI registered on the app, so
   sign-in fails if this is missing or different.
3. Open the app and copy its **OAuth identifier** (your client ID) and **OAuth
   secret** (your client secret).

Treat the secret like a password: don't commit it or paste it into a chat.

## 2. Connect your FreeAgent account

This is a one-time sign-in that lets the server read and write your FreeAgent
data.

1. In a terminal, set the two credentials and run the sign-in:

   ```bash
   export FREEAGENT_CLIENT_ID="your OAuth identifier"
   export FREEAGENT_CLIENT_SECRET="your OAuth secret"
   npx freeagent-mcp-server auth
   ```

2. Your browser opens FreeAgent. Log in to the FreeAgent account whose books you
   want Claude to use, and **approve** the app. If you're already logged in to a
   different FreeAgent company, log out first.
3. The browser shows "Authentication successful" and the terminal says
   "Authentication complete! Tokens saved."

Do it within 2 minutes of running the command, or it gives up; just run it again.
If the browser doesn't come back on its own, copy the full address from its
address bar (it starts `http://localhost:3456/callback?code=`) and paste it into
the terminal. That needs a normal, interactive terminal window.

The tokens are saved in `~/.freeagent-mcp/tokens.json` and refresh themselves, so
you won't sign in again unless you revoke access or delete that file.

## 3. Add it to your AI app

The steps below are for Claude. For Codex CLI, Cursor, VS Code, Windsurf or Gemini
CLI, use the snippet for your app in
[configuration.md](configuration.md#mcp-clients) instead: same command, same
credentials. (ChatGPT and Grok can't use it yet:
[why](configuration.md#chatgpt-and-grok).)


**Claude Desktop and Cowork:** open the config file, creating it if it isn't
there:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

and add:

```json
{
  "mcpServers": {
    "freeagent": {
      "command": "npx",
      "args": ["-y", "freeagent-mcp-server"],
      "env": {
        "FREEAGENT_CLIENT_ID": "your OAuth identifier",
        "FREEAGENT_CLIENT_SECRET": "your OAuth secret"
      }
    }
  }
}
```

If the file already has an `mcpServers` section, add `"freeagent": { … }` inside
it rather than a second section. Then quit and reopen Claude Desktop.

**Claude Code:** add the same block to `.mcp.json` in your project, or run:

```bash
claude mcp add freeagent \
  -e FREEAGENT_CLIENT_ID="your OAuth identifier" \
  -e FREEAGENT_CLIENT_SECRET="your OAuth secret" \
  -- npx -y freeagent-mcp-server
```

## 4. Check it works

Ask Claude: **"Show me my FreeAgent company details."** It should answer with
your company's name. If it can't find any FreeAgent tools, the config didn't
load: check the JSON and restart the client. Other errors:
[troubleshooting.md](troubleshooting.md).

## Optional extras

- **Attach receipts** to expenses and bills: make a folder for them and add
  `"FREEAGENT_ATTACHMENTS_DIR": "/path/to/receipts"` to `env`. Only files in
  that folder can be attached ([security.md](security.md#attachments)).
- **Manage users or email invoices:** these four tools are off by default. Add
  `"FREEAGENT_ENABLE_SENSITIVE_TOOLS": "true"` to `env` to turn them on
  ([security.md](security.md#sensitive-tools)).
- **Try it on test data first:** create a free sandbox company at
  [signup.sandbox.freeagent.com](https://signup.sandbox.freeagent.com/signup)
  and finish its setup steps. Then add `FREEAGENT_SANDBOX=true` to both the
  `auth` command and `env`. Sandbox tokens are stored separately
  (`tokens.sandbox.json`), so this doesn't disconnect your real books.

## Disconnecting

Delete `~/.freeagent-mcp/tokens.json` (and `tokens.sandbox.json`, if you used the
sandbox) and remove the `freeagent` entry from your
client's config. To also cut off the app on FreeAgent's side, revoke its access
in your FreeAgent account's settings.
