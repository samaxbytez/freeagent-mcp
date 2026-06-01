# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.3.0]: https://github.com/samaxbytez/freeagent-mcp/releases/tag/v1.3.0
[1.2.0]: https://github.com/samaxbytez/freeagent-mcp/releases/tag/v1.2.0
