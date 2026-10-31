# Troubleshooting

**"Missing credentials" error on startup**
Set `FREEAGENT_CLIENT_ID` and `FREEAGENT_CLIENT_SECRET` environment variables, then run `npx freeagent-mcp-server auth` to authenticate.

**"No stored tokens found"**
You need to complete the one-time auth flow first: `npx freeagent-mcp-server auth`. For the sandbox, run it with `FREEAGENT_SANDBOX=true`: sandbox tokens are kept in their own file.

**Authentication times out**
If the automatic redirect doesn't work, copy the full URL from your browser's address bar after approving and paste it into the terminal. Pasting needs an interactive terminal, so run `auth` in a normal terminal tab. The sign-in gives up after 2 minutes; run it again if you were still logging in. Ensure your FreeAgent app's redirect URI is set to `http://localhost:3456/callback`.

**Port 3456 is busy**
The auth flow will automatically fall back to manual paste mode. Just paste the redirect URL from your browser after approving.

**401 Unauthorized errors**
Your tokens may have been revoked. Re-run `npx freeagent-mcp-server auth` to re-authenticate.

**"FreeAgent API error (403)"**
Your token may not have the required permission level. Check that your FreeAgent app has the appropriate access scopes.

**Sandbox vs Production**
By default the server connects to the FreeAgent production API. Set `FREEAGENT_SANDBOX=true` to use the sandbox.

**Tool not found**
Ensure you're using the correct tool name with the `freeagent_` prefix (e.g., `freeagent_list_invoices`, not `list_invoices`).

**Empty responses**
Some endpoints return empty responses for successful DELETE operations. This is expected behavior.
