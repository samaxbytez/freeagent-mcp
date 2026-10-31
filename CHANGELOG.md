# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-10-31

### Breaking

- **Node.js 24 or later is required.** Node 18 and 20 are end-of-life and the
  test toolchain no longer runs on them.
- **Sensitive tools are off by default.** `freeagent_create_user`,
  `freeagent_update_user`, `freeagent_delete_user` and
  `freeagent_send_invoice_email` are only registered when
  `FREEAGENT_ENABLE_SENSITIVE_TOOLS=true`, so text injected into FreeAgent data
  cannot invite users or email invoices out.

### Added

- **Receipt attachments**: `create_expense`, `update_expense`, `create_bill` and
  `update_bill` accept `attachment_path` (PDF, PNG, JPEG or GIF, max 5MB), sent in
  the same request as the record. Reads are confined to the required
  `FREEAGENT_ATTACHMENTS_DIR`.
- **Pagination**: every list tool accepts `page` and `per_page` (up to 100) and
  returns a `pagination` object with the total count and next/last page.
  Previously only the first 25 records were returned, with no sign more existed.
- **Tool annotations**: every tool declares `readOnlyHint`, `destructiveHint`
  and `openWorldHint`, so clients can ask before writes and deletes.

### Security

- `freeagent_get_category` now validates `nominal_code` with `safeId`.
- The API client checks the resolved request path stays under the API base,
  closing a bypass of the `../` check via percent-encoded `%2e%2e/`.
- OAuth callback server binds to `127.0.0.1`, ignores requests without the
  session's `state` instead of aborting the login, and never reflects query
  values. A missing browser opener no longer crashes the flow, and an existing
  `~/.freeagent-mcp` is tightened to `0o700`.
- `@modelcontextprotocol/sdk` updated to 1.32.2, clearing its published
  advisories and those of its HTTP-transport dependencies.

### Changed

- The User-Agent no longer sends a stale hardcoded version.
- Release PRs are opened locally with `/release`; the Claude-based docs and
  release agents were removed from CI, and npm publishing no longer runs
  dependency code in the job that holds the publish token.

## [1.3.0] - 2026-06-01

### Security

- **Command injection**: replaced `exec()` with `execFile()` in the OAuth browser
  launcher so the auth URL can no longer be interpreted by a shell.
- **SSRF / token exfiltration**: `FreeAgentClient` now rejects absolute URLs and
  `../` traversal in request paths, and verifies the resolved URL's origin
  matches the API base — the bearer token can no longer be redirected off-origin.
- **Path traversal via IDs**: added a `safeId` schema (`/^[a-zA-Z0-9_-]+$/`)
  applied to all ID parameters across every tool.
- **Token storage**: the `~/.freeagent-mcp/` directory is now created with `0o700`
  permissions.

### Fixed

- **Windows browser launch**: the OAuth flow now opens the browser via
  `explorer.exe` instead of `cmd /c start`. `cmd.exe` treats `&` as a command
  separator, which truncated the authorization URL at its first query separator;
  `explorer.exe` receives the URL as a single literal argument, leaving the query
  string intact.

## [1.2.0] - 2026-02

- Default to the production FreeAgent API and add an auth paste fallback.
- Built-in OAuth2 flow with automatic token refresh.

[2.0.0]: https://github.com/samaxbytez/freeagent-mcp/compare/v1.3.0...v2.0.0
[1.3.0]: https://github.com/samaxbytez/freeagent-mcp/releases/tag/v1.3.0
[1.2.0]: https://github.com/samaxbytez/freeagent-mcp/releases/tag/v1.2.0
