# Security

This server's threat model is **indirect prompt injection**: text that FreeAgent
returns can be written by third parties and reach the model as tool output. The
rules that keep that contained, and that a change must not weaken, are in
[AGENTS.md](../AGENTS.md#security-conventions-this-repos-threat-model-is-indirect-prompt-injection).

## Sensitive tools

Text that FreeAgent returns — bank transaction references, contact names, comments — can be written by third parties, so it can carry instructions aimed at the model (indirect prompt injection). Tools that could hand account access or company data to someone outside the account are therefore not registered unless `FREEAGENT_ENABLE_SENSITIVE_TOOLS=true`:

- `freeagent_create_user`, `freeagent_update_user`, `freeagent_delete_user`
- `freeagent_send_invoice_email`
- `freeagent_create_bank_account`: a new account could carry someone else's
  sort code or IBAN and be made the primary account

And one field: `freeagent_update_contact` has no `email` argument unless they're
on, because changing a customer's email would redirect FreeAgent's own invoice
and reminder emails. New contacts can still be given an email.

Every tool also carries MCP annotations (`readOnlyHint`, `destructiveHint`, `openWorldHint`) so clients can ask for confirmation before writes and deletes.

## Read-only mode

```bash
export FREEAGENT_READ_ONLY=true
```

Only tools annotated `readOnlyHint` are registered, which today means the `list_*` and
`get_*` tools; a test checks none of them writes. Nothing that creates, updates,
deletes, sends an email or saves a download exists in the session, so an injected
instruction has no write to reach for. It wins over `FREEAGENT_ENABLE_SENSITIVE_TOOLS`,
whose tools all write. Use it for reporting and reconciliation sessions; to keep
writes but drop a few tools, switch those off in your MCP client instead.

## Attachments

`freeagent_create_expense`, `freeagent_update_expense`, `freeagent_create_bill` and
`freeagent_update_bill` accept an optional `attachment_path` pointing at a receipt or
invoice on local disk. The file is read by the server, base64-encoded and sent **in the
same request** as the record itself, so an expense is never created without its receipt.

```jsonc
{
  "user": "https://api.freeagent.com/v2/users/1",
  "category": "https://api.freeagent.com/v2/categories/270",
  "dated_on": "2026-08-05",
  "gross_value": "189.99",
  "attachment_path": "./invoice.pdf"
}
```

PDF, PNG, JPEG and GIF only, 5MB maximum, which is what the FreeAgent API itself accepts.

`freeagent_add_bank_transaction_explanation_attachments` takes `attachment_paths`, up to
10 files, read under exactly the same rules. Every file is read and checked before any
is sent, so one refused path attaches nothing.

### `FREEAGENT_ATTACHMENTS_DIR` is required

```bash
export FREEAGENT_ATTACHMENTS_DIR="$HOME/receipts"
```

Without it, `attachment_path`, `attachment_paths` and `freeagent_download_attachment` are refused. This is the server's only local file access, and
it is driven by a model whose inputs an attacker may influence, so it is scoped rather
than open.

The reason it is not merely advisory: an unrestricted read would reach any PDF, PNG or
JPEG on the machine, which is where bank statements, contracts, scanned ID and
screenshots of credentials live. Nor does the data stop in your own books. The API
returns `attachment.content_src`, a pre-signed S3 URL that downloads with **no token**,
and `freeagent_get_expense` returns it to the model. Scoping the read to one directory
is what breaks that chain.

Also enforced: symlinks and `..` are resolved before anything is judged, so a `.pdf`
symlink pointing at a private key is rejected rather than uploaded; the root and
extension are checked against the path as given before the filesystem is touched, so
error messages cannot be used to probe what exists outside the root or which
non-attachable files exist inside it; only regular files with a single hard link
are read (a hard link inside the folder to a file elsewhere is refused); the file
is opened once and checked through that handle, so it can't be swapped between
the checks and the read; and a folder that contains your home directory (such as
`/Users`) is refused as the root, like the home directory itself.

Pre-signed download links (`content_src` and its variants) are removed from
everything the tools return, so a receipt's link can't be passed on by an
injected instruction. The attachment's file name and type are kept.

### Downloading attachments

`freeagent_download_attachment` saves a receipt into the same folder, and nowhere
else. The server fetches FreeAgent's pre-signed link itself, so the link never
reaches the model, and it never sends your bearer token with it. The download must
be https, may not redirect, and times out after 30 seconds.

FreeAgent's file name is treated as untrusted: it is reduced to a plain name, must
end in `.pdf`, `.png`, `.jpg`, `.jpeg` or `.gif`, and is created fresh with
permissions `0600`. An existing file or a planted symlink is never overwritten; a
clashing name gets a ` (1)` suffix instead. Each file is capped at 25MB and each
server session at 250MB in total, so an injected loop can't fill your disk.

## Supply chain

The npm package has no dependencies: the server, the MCP SDK and zod are bundled
into one file at build time. Installing it with `npx` downloads only that file,
so the versions you run are the ones fixed at release time and tested in CI,
not whatever an upstream package published that morning. A malicious upstream
release would only reach you if it were bundled into a later release here.

That moves the trust to the build: dependency updates arrive as reviewable
pull requests, releases are built with install scripts disabled and published
with npm provenance, and publishing needs a maintainer's approval in GitHub. The
build itself runs dev tools (esbuild, vitest), so they're part of what has to be
trusted.

## Tokens

OAuth tokens are stored in `~/.freeagent-mcp/tokens.json` (sandbox:
`tokens.sandbox.json`), written `0o600` in a `0o700` directory, and refreshed
automatically. They are never logged. Requests time out after 30 seconds. The
bearer token is only ever sent to the configured API origin: the client rejects
absolute URLs and any path that resolves outside the API base, including encoded
`%2e%2e/`.
