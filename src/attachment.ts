import { constants } from "node:fs";
import { open, realpath, type FileHandle } from "node:fs/promises";
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

  const { confineTo, root } = await resolveAttachmentsRoot(
    "attachment_path requires FREEAGENT_ATTACHMENTS_DIR to be set to the directory " +
      "receipts live in. Attachments are not read from arbitrary paths."
  );

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

  // Open once and judge the opened file rather than the path: stat-then-readFile
  // re-resolved the path each time, so a symlink swapped in between was followed.
  // O_NOFOLLOW refuses a symlink planted at the final component after realpath;
  // O_NONBLOCK stops a FIFO from blocking the open (it is then refused below).
  let handle: FileHandle;
  try {
    handle = await open(
      resolved,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0)
    );
  } catch {
    throw new Error(`Attachment could not be opened: ${inputPath}`);
  }

  let bytes: Buffer;
  try {
    const info = await handle.stat();
    if (!info.isFile()) {
      throw new Error(`Attachment is not a regular file: ${inputPath}`);
    }
    // A hard link inside the root to a file outside it looks like an ordinary file
    // in the root: realpath returns the in-root name. Refuse multiply-linked files.
    if (info.nlink > 1) {
      throw new Error(`Attachment has more than one hard link and was not read: ${inputPath}`);
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

    // Read at most one byte past the cap, so a file that grows after the size check
    // can neither be uploaded nor make us allocate all of it.
    const buffer = Buffer.alloc(MAX_ATTACHMENT_BYTES + 1);
    let filled = 0;
    while (filled < buffer.length) {
      const { bytesRead } = await handle.read(buffer, filled, buffer.length - filled, filled);
      if (bytesRead === 0) break;
      filled += bytesRead;
    }
    if (filled > MAX_ATTACHMENT_BYTES) {
      throw new Error(
        `Attachment grew past ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB while being read and was not sent.`
      );
    }
    bytes = buffer.subarray(0, filled);
  } finally {
    await handle.close();
  }

  return {
    data: bytes.toString("base64"),
    file_name: path.basename(resolved),
    content_type: contentType,
  };
}

/**
 * Resolve and vet FREEAGENT_ATTACHMENTS_DIR. Shared by reads (uploads) and writes
 * (downloads) so both are confined to the same dedicated directory.
 *
 * @param unsetMessage Error thrown when the variable is unset, worded for the caller.
 */
export async function resolveAttachmentsRoot(
  unsetMessage: string
): Promise<{ confineTo: string; root: string }> {
  const confineTo = process.env.FREEAGENT_ATTACHMENTS_DIR;
  if (!confineTo || confineTo.trim() === "") {
    throw new Error(unsetMessage);
  }

  let root: string;
  try {
    root = await realpath(confineTo);
  } catch {
    throw new Error("FREEAGENT_ATTACHMENTS_DIR is set to a path that does not exist");
  }
  // A root this broad makes confinement meaningless: every PDF or image on the
  // machine (or in the user's home) would be attachable. That includes any folder
  // that contains the home directory, such as /Users or /home.
  const home = await realpath(homedir()).catch(() => homedir());
  if (root === path.parse(root).root || root === home || isInside(root, home)) {
    throw new Error(
      "FREEAGENT_ATTACHMENTS_DIR must be a dedicated receipts directory, not the filesystem root, your home directory or a folder containing it"
    );
  }
  return { confineTo, root };
}

/** Downloads may exceed the 5MB upload cap (files added in the web app), but not by much. */
export const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Reduce an untrusted file name (it comes from FreeAgent, and so from whoever uploaded
 * the file) to a plain basename that cannot escape the root or hide its type.
 */
export function safeDownloadName(fileName: string): string {
  const base = path.basename(fileName.replace(/\\/g, "/"));
  const cleaned = base
    .replace(/[^A-Za-z0-9._ ()-]/g, "_")
    .replace(/^[.\s]+/, "")
    .slice(0, 150);
  if (!cleaned || !path.extname(cleaned)) {
    throw new Error(`Attachment file name is not usable: ${JSON.stringify(fileName)}`);
  }
  contentTypeFor(cleaned);
  return cleaned;
}

/**
 * Write downloaded attachment bytes into FREEAGENT_ATTACHMENTS_DIR.
 *
 * The write is confined the same way reads are: the name is reduced to a basename,
 * must carry an allowlisted extension, and is created with O_EXCL | O_NOFOLLOW so an
 * existing file (or a planted symlink) is never overwritten. On a name clash a
 * " (n)" suffix is added instead.
 *
 * @returns The absolute path written.
 */
export async function saveAttachment(fileName: string, bytes: Uint8Array): Promise<string> {
  const { root } = await resolveAttachmentsRoot(
    "Downloading attachments requires FREEAGENT_ATTACHMENTS_DIR to be set to the " +
      "directory receipts live in. Files are not written to arbitrary paths."
  );
  if (bytes.length === 0) throw new Error("Attachment download was empty");
  if (bytes.length > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Attachment is larger than ${MAX_DOWNLOAD_BYTES / 1024 / 1024}MB and was not saved`);
  }

  const name = safeDownloadName(fileName);
  const ext = path.extname(name);
  const stem = name.slice(0, -ext.length);

  for (let n = 0; n < 100; n++) {
    const candidate = path.join(root, n === 0 ? name : `${stem} (${n})${ext}`);
    if (!isInside(root, candidate)) throw outsideRoot();
    let handle: FileHandle;
    try {
      handle = await open(
        candidate,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0),
        0o600
      );
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") continue;
      throw new Error(`Attachment could not be saved as ${path.basename(candidate)}`);
    }
    try {
      await handle.writeFile(bytes);
    } finally {
      await handle.close();
    }
    return candidate;
  }
  throw new Error(`Too many files named like ${name} in the attachment directory`);
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
