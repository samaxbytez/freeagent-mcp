import { readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { z } from "zod";

/**
 * Reading attachments off local disk is the only practical way to expose FreeAgent's
 * attachment support over MCP: the payload is base64 and a real receipt runs to well
 * over 100KB, which no model can be asked to emit as a tool argument.
 *
 * That makes this the first local file read in the server, so it is default-deny.
 * FREEAGENT_ATTACHMENTS_DIR must be set; without it `attachment_path` is refused.
 *
 * The reason it is not merely advisory: this repo's threat model is indirect prompt
 * injection, so *every* operator is by definition handling untrusted input. An
 * unrestricted read would let an injected tool argument pull any PDF, PNG or JPEG on
 * the machine (bank statements, contracts, scanned ID, screenshots of credentials,
 * MFA enrolment QR codes) into an expense. Uploading it is not the end of it either:
 * the API returns `attachment.content_src`, a pre-signed S3 URL that downloads with
 * no token at all, and `freeagent_get_expense` hands that straight back to the model.
 * Scoping the read to one directory is what breaks that chain.
 *
 * Beyond the root check: the root and extension are first checked lexically, before
 * any filesystem access, so error messages cannot be used to probe whether a file
 * exists outside the root or a non-attachable file exists inside it. Symlinks and `..`
 * are then resolved and both checks run again on the true target, so neither can be
 * fooled by `receipt.pdf -> ~/.ssh/id_rsa`. Only regular files are read, so devices
 * and FIFOs are out.
 */

/** FreeAgent rejects attachments above 5MB. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/**
 * Extensions FreeAgent accepts, mapped to the content_type it expects. The Expenses and
 * Bills docs list exactly: image/png, image/x-png, image/jpeg, image/jpg, image/gif and
 * application/x-pdf. Note PDF is `application/x-pdf`, not the more common
 * `application/pdf`, which is not on that list.
 */
export const ATTACHMENT_CONTENT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  ".pdf": "application/x-pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
});

/** Shared so the four tools that accept an attachment cannot drift in wording. */
export const attachmentPathSchema = z
  .string()
  .optional()
  .describe(
    "Path to a local receipt or invoice file to attach (PDF, PNG, JPEG or GIF, max 5MB). Sent in the same request, so the record is never created without its receipt."
  );

export interface Attachment {
  data: string;
  file_name: string;
  content_type: string;
}

/**
 * True when `child` is inside `parent`. Both must already be realpath-resolved.
 *
 * Uses path.relative rather than a string prefix on purpose: `startsWith` would treat
 * `/vaultsecrets/x.pdf` as inside `/vault`. The isAbsolute clause is load-bearing on
 * Windows, where a different drive yields an absolute relative-path.
 */
export function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return (
    rel !== "" &&
    rel !== ".." &&
    !rel.startsWith(".." + path.sep) &&
    !path.isAbsolute(rel)
  );
}

/**
 * Read a local file and shape it as a FreeAgent attachment object.
 *
 * @param inputPath Path to the receipt or invoice, inside FREEAGENT_ATTACHMENTS_DIR.
 * @throws if that variable is unset, or the file is missing, outside the configured
 *         root, of an unsupported type, not a regular file, empty, or too large.
 */
export async function readAttachment(inputPath: string): Promise<Attachment> {
  if (!inputPath || inputPath.trim() === "") {
    throw new Error("attachment_path must not be empty");
  }

  const confineTo = process.env.FREEAGENT_ATTACHMENTS_DIR;
  if (!confineTo || confineTo.trim() === "") {
    throw new Error(
      "attachment_path requires FREEAGENT_ATTACHMENTS_DIR to be set to the directory " +
        "receipts live in. Attachments are not read from arbitrary paths."
    );
  }

  let root: string;
  try {
    root = await realpath(confineTo);
  } catch {
    throw new Error("FREEAGENT_ATTACHMENTS_DIR is set to a path that does not exist");
  }
  // A root this broad makes confinement meaningless: every PDF or image on the
  // machine (or in the user's home) would be attachable.
  const home = await realpath(homedir()).catch(() => homedir());
  if (root === path.parse(root).root || root === home) {
    throw new Error(
      "FREEAGENT_ATTACHMENTS_DIR must be a dedicated receipts directory, not the filesystem root or your home directory"
    );
  }

  // Lexical checks BEFORE touching the input path on disk. If realpath ran first, its
  // "not found" would reveal whether any file on the machine exists ("outside" vs "not
  // found"), and inside the root whether e.g. secrets.txt exists ("does not accept" vs
  // "not found"). The configured root is accepted in both its given and resolved
  // forms, since it may itself sit behind a symlink (e.g. /tmp on macOS).
  const lexical = path.resolve(inputPath);
  if (!isInside(path.resolve(confineTo), lexical) && !isInside(root, lexical)) {
    throw outsideRoot();
  }
  contentTypeFor(lexical);

  // Now resolve symlinks and `..` and judge the true target again: a link inside the
  // root can point outside it, and `receipt.pdf` can point at `id_rsa`.
  let resolved: string;
  try {
    resolved = await realpath(inputPath);
  } catch {
    throw new Error(`Attachment not found: ${inputPath}`);
  }
  if (!isInside(root, resolved)) {
    throw outsideRoot();
  }

  // Extension check BEFORE stat, so "not a regular file" / "is empty" / a byte count
  // cannot be used to probe paths that could never be attached anyway.
  const contentType = contentTypeFor(resolved);

  const info = await stat(resolved);
  if (!info.isFile()) {
    throw new Error(`Attachment is not a regular file: ${inputPath}`);
  }
  if (info.size === 0) {
    throw new Error(`Attachment is empty: ${inputPath}`);
  }
  if (info.size > MAX_ATTACHMENT_BYTES) {
    const mb = (info.size / 1024 / 1024).toFixed(1);
    throw new Error(
      `Attachment is ${mb}MB. FreeAgent rejects attachments over ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB.`
    );
  }

  const bytes = await readFile(resolved);

  // stat and read are separate syscalls, so judge the bytes actually held rather than
  // trusting the earlier size. This bounds what is uploaded, not what is allocated.
  if (bytes.length > MAX_ATTACHMENT_BYTES) {
    throw new Error(
      `Attachment grew past ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB while being read and was not sent.`
    );
  }

  return {
    data: bytes.toString("base64"),
    file_name: path.basename(resolved),
    content_type: contentType,
  };
}

function outsideRoot(): Error {
  // The root is deliberately not echoed. It is a canonical absolute path, and naming
  // it would tell an attacker where the real invoices are kept.
  return new Error(
    "Attachment is outside the configured attachment directory and was not read"
  );
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ATTACHMENT_CONTENT_TYPES[ext];
  if (!contentType) {
    const supported = Object.keys(ATTACHMENT_CONTENT_TYPES).sort().join(", ");
    throw new Error(
      `FreeAgent does not accept "${ext || "extensionless"}" attachments. Supported: ${supported}`
    );
  }
  return contentType;
}
