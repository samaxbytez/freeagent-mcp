import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  readAttachment,
  MAX_ATTACHMENT_BYTES,
  ATTACHMENT_CONTENT_TYPES,
} from "./attachment.js";

const PDF_BYTES = Buffer.from("%PDF-1.4 fake", "utf8");

let dir: string;
let pdf: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "fa-attach-"));
  pdf = path.join(dir, "receipt.pdf");
  await writeFile(pdf, PDF_BYTES);
  delete process.env.FREEAGENT_ATTACHMENTS_DIR;
});

afterEach(async () => {
  delete process.env.FREEAGENT_ATTACHMENTS_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("readAttachment", () => {
  it("base64-encodes the file and derives name and content type", async () => {
    const att = await readAttachment(pdf);
    expect(Buffer.from(att.data, "base64").equals(PDF_BYTES)).toBe(true);
    expect(att.file_name).toBe("receipt.pdf");
    expect(att.content_type).toBe("application/pdf");
  });

  it("maps every supported extension, case-insensitively", async () => {
    for (const [ext, type] of Object.entries(ATTACHMENT_CONTENT_TYPES)) {
      const p = path.join(dir, `upper${ext.toUpperCase()}`);
      await writeFile(p, PDF_BYTES);
      expect((await readAttachment(p)).content_type).toBe(type);
    }
  });

  it("rejects an unsupported extension", async () => {
    const txt = path.join(dir, "notes.txt");
    await writeFile(txt, PDF_BYTES);
    await expect(readAttachment(txt)).rejects.toThrow(/does not accept/);
  });

  it("rejects an empty file", async () => {
    const empty = path.join(dir, "empty.pdf");
    await writeFile(empty, Buffer.alloc(0));
    await expect(readAttachment(empty)).rejects.toThrow(/empty/);
  });

  it("rejects a file over the size cap", async () => {
    const big = path.join(dir, "big.pdf");
    await writeFile(big, Buffer.alloc(MAX_ATTACHMENT_BYTES + 1));
    await expect(readAttachment(big)).rejects.toThrow(/rejects attachments over/);
  });

  it("rejects a directory", async () => {
    const sub = path.join(dir, "folder.pdf");
    await mkdir(sub);
    await expect(readAttachment(sub)).rejects.toThrow(/not a regular file/);
  });

  it("rejects a missing file and an empty path", async () => {
    await expect(readAttachment(path.join(dir, "nope.pdf"))).rejects.toThrow(/not found/);
    await expect(readAttachment("")).rejects.toThrow(/must not be empty/);
    await expect(readAttachment("   ")).rejects.toThrow(/must not be empty/);
  });

  // The one that matters: the extension allowlist is worthless if a .pdf symlink
  // pointing at a private key is read as a receipt.
  it("checks the extension of the symlink TARGET, not the link name", async () => {
    const secret = path.join(dir, "id_rsa");
    await writeFile(secret, "PRIVATE KEY");
    const link = path.join(dir, "innocent.pdf");
    try {
      await symlink(secret, link);
    } catch {
      return; // symlink creation needs privilege on some Windows setups
    }
    await expect(readAttachment(link)).rejects.toThrow(/does not accept/);
  });

  it("resolves .. before checking, so traversal cannot disguise the target", async () => {
    const nested = path.join(dir, "sub");
    await mkdir(nested);
    const viaTraversal = path.join(nested, "..", "receipt.pdf");
    expect((await readAttachment(viaTraversal)).file_name).toBe("receipt.pdf");
  });

  describe("FREEAGENT_ATTACHMENTS_DIR confinement", () => {
    it("allows a file inside the configured root", async () => {
      process.env.FREEAGENT_ATTACHMENTS_DIR = dir;
      expect((await readAttachment(pdf)).file_name).toBe("receipt.pdf");
    });

    it("allows a file in a subdirectory of the root", async () => {
      const sub = path.join(dir, "2026");
      await mkdir(sub);
      const inner = path.join(sub, "inner.pdf");
      await writeFile(inner, PDF_BYTES);
      process.env.FREEAGENT_ATTACHMENTS_DIR = dir;
      expect((await readAttachment(inner)).file_name).toBe("inner.pdf");
    });

    it("blocks a file outside the root", async () => {
      const outside = await mkdtemp(path.join(tmpdir(), "fa-outside-"));
      try {
        const p = path.join(outside, "elsewhere.pdf");
        await writeFile(p, PDF_BYTES);
        process.env.FREEAGENT_ATTACHMENTS_DIR = dir;
        await expect(readAttachment(p)).rejects.toThrow(/outside FREEAGENT_ATTACHMENTS_DIR/);
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    });

    it("blocks a symlink that escapes the root", async () => {
      const outside = await mkdtemp(path.join(tmpdir(), "fa-outside-"));
      try {
        const target = path.join(outside, "escaped.pdf");
        await writeFile(target, PDF_BYTES);
        const link = path.join(dir, "looks-local.pdf");
        try {
          await symlink(target, link);
        } catch {
          return;
        }
        process.env.FREEAGENT_ATTACHMENTS_DIR = dir;
        await expect(readAttachment(link)).rejects.toThrow(/outside FREEAGENT_ATTACHMENTS_DIR/);
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    });

    it("is inert when unset or blank", async () => {
      process.env.FREEAGENT_ATTACHMENTS_DIR = "";
      expect((await readAttachment(pdf)).file_name).toBe("receipt.pdf");
    });

    it("fails loudly when set to a path that does not exist", async () => {
      process.env.FREEAGENT_ATTACHMENTS_DIR = path.join(dir, "missing");
      await expect(readAttachment(pdf)).rejects.toThrow(/does not exist/);
    });
  });
});
