import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Reading attachments off local disk is the only practical way to expose FreeAgent's
 * attachment support over MCP: the payload is base64 and a real receipt runs to well
 * over 100KB, which no model can be asked to emit as a tool argument.
 *
 * That makes this the first local file read in the server, so it is deliberately
 * narrow. This repo's threat model is indirect prompt injection, and the risk here is
 * an injected instruction attaching something sensitive to an expense to get it off
 * the machine. Four things bound that:
 *
 *   1. Symlinks and `..` are resolved BEFORE any check, so the extension test cannot
 *      be fooled by `receipt.pdf -> ~/.ssh/id_rsa`.
 *   2. The extension allowlist is checked on the RESOLVED path, and holds only the
 *      types FreeAgent itself accepts.
 *   3. Only regular files are read. No directories, devices or FIFOs.
 *   4. FREEAGENT_ATTACHMENTS_DIR, when set, confines reads to one directory tree.
 *      Operators handling untrusted input should set it.
 */

/** FreeAgent rejects attachments above 5MB. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** Extensions FreeAgent accepts, mapped to the content_type it expects. */
export const ATTACHMENT_CONTENT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
});

export interface Attachment {
  data: string;
  file_name: string;
  content_type: string;
}

/** True when `child` is inside `parent`, both already realpath-resolved. */
function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Read a local file and shape it as a FreeAgent attachment object.
 *
 * @param inputPath Path to the receipt or invoice on local disk.
 * @throws if the file is missing, not a regular file, empty, too large, of an
 *         unsupported type, or outside FREEAGENT_ATTACHMENTS_DIR when that is set.
 */
export async function readAttachment(inputPath: string): Promise<Attachment> {
  if (!inputPath || inputPath.trim() === "") {
    throw new Error("attachment_path must not be empty");
  }

  // realpath first: every check below must run against the true target, not a
  // symlink or a path containing `..`.
  let resolved: string;
  try {
    resolved = await realpath(inputPath);
  } catch {
    throw new Error(`Attachment not found: ${inputPath}`);
  }

  const confineTo = process.env.FREEAGENT_ATTACHMENTS_DIR;
  if (confineTo && confineTo.trim() !== "") {
    let root: string;
    try {
      root = await realpath(confineTo);
    } catch {
      throw new Error(`FREEAGENT_ATTACHMENTS_DIR does not exist: ${confineTo}`);
    }
    if (!isInside(root, resolved)) {
      throw new Error(
        `Attachment is outside FREEAGENT_ATTACHMENTS_DIR (${root}) and was not read`
      );
    }
  }

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

  const ext = path.extname(resolved).toLowerCase();
  const contentType = ATTACHMENT_CONTENT_TYPES[ext];
  if (!contentType) {
    const supported = Object.keys(ATTACHMENT_CONTENT_TYPES).sort().join(", ");
    throw new Error(
      `FreeAgent does not accept "${ext || "extensionless"}" attachments. Supported: ${supported}`
    );
  }

  const bytes = await readFile(resolved);

  // stat and read are separate syscalls, so re-check the bytes actually held rather
  // than trusting the earlier size. A file that grew in between must not slip past.
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
