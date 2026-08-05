import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  readAttachment,
  isInside,
  MAX_ATTACHMENT_BYTES,
  ATTACHMENT_CONTENT_TYPES,
} from "./attachment.js";

const PDF_BYTES = Buffer.from("%PDF-1.4 fake", "utf8");

// Creating a symlink needs privilege on Windows without Developer Mode. Probe so the
// affected tests report as SKIPPED rather than silently returning green — they pin the
// most important property in the module and must not vanish quietly on CI.
//
// The probe MUST be synchronous at module scope: it.skipIf is evaluated during
// collection, before any beforeAll hook runs, so a hook-assigned flag is still false
// and would skip these unconditionally — the same silent loss in a new disguise.
const canSymlink = ((): boolean => {
  const probe = mkdtempSync(path.join(tmpdir(), "fa-symprobe-"));
  try {
    writeFileSync(path.join(probe, "t"), "x");
    symlinkSync(path.join(probe, "t"), path.join(probe, "l"));
    return true;
  } catch {
    return false;
  } finally {
    rmSync(probe, { recursive: true, force: true });
  }
})();

let dir: string;
let pdf: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "fa-attach-"));
  pdf = path.join(dir, "receipt.pdf");
  await writeFile(pdf, PDF_BYTES);
  // Default-deny: nearly every test needs a root, so set it and let the tests that
  // care about its absence clear it explicitly.
  process.env.FREEAGENT_ATTACHMENTS_DIR = dir;
});

afterEach(async () => {
  delete process.env.FREEAGENT_ATTACHMENTS_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("isInside", () => {
  // isInside IS the confinement control, so pin the properties that make it correct.
  // A naive `child.startsWith(parent)` passes the happy-path tests below but fails
  // every case here; without these, "simplifying" it would ship green.
  const root = path.join(path.sep, "vault");

  it("accepts a direct child and a nested descendant", () => {
    expect(isInside(root, path.join(root, "a.pdf"))).toBe(true);
    expect(isInside(root, path.join(root, "2026", "a.pdf"))).toBe(true);
  });

  it("rejects a sibling directory sharing the root's name prefix", () => {
    expect(isInside(root, path.join(path.sep, "vaultsecrets", "a.pdf"))).toBe(false);
  });

  it("rejects the root itself and a parent of it", () => {
    expect(isInside(root, root)).toBe(false);
    expect(isInside(root, path.dirname(root))).toBe(false);
  });

  it("rejects an escape via ..", () => {
    expect(isInside(root, path.join(path.sep, "elsewhere", "a.pdf"))).toBe(false);
  });

  it.runIf(process.platform === "win32")("rejects a different drive", () => {
    expect(isInside("C:\\vault", "D:\\a.pdf")).toBe(false);
  });

  it("allows a legitimate name beginning with two dots", () => {
    expect(isInside(root, path.join(root, "..hidden.pdf"))).toBe(true);
  });
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

  // The extension check runs before stat so that "is not a regular file", "is empty"
  // and a byte count cannot be used to probe paths that could never be attached.
  it("reports unsupported type, not existence or shape, for a non-attachable path", async () => {
    const secretDir = path.join(dir, "dot-ssh");
    await mkdir(secretDir);
    await expect(readAttachment(secretDir)).rejects.toThrow(/does not accept/);

    const emptyTxt = path.join(dir, "probe.txt");
    await writeFile(emptyTxt, Buffer.alloc(0));
    await expect(readAttachment(emptyTxt)).rejects.toThrow(/does not accept/);
  });

  it.skipIf(!canSymlink)(
    "checks the extension of the symlink TARGET, not the link name",
    async () => {
      const secret = path.join(dir, "id_rsa");
      await writeFile(secret, "PRIVATE KEY");
      const link = path.join(dir, "innocent.pdf");
      await symlink(secret, link);
      await expect(readAttachment(link)).rejects.toThrow(/does not accept/);
    }
  );

  it("resolves .. before checking, so traversal cannot disguise the target", async () => {
    const nested = path.join(dir, "sub");
    await mkdir(nested);
    const viaTraversal = path.join(nested, "..", "receipt.pdf");
    expect((await readAttachment(viaTraversal)).file_name).toBe("receipt.pdf");
  });

  describe("FREEAGENT_ATTACHMENTS_DIR confinement", () => {
    // Default-deny. The threat model is indirect prompt injection, so every operator
    // is handling untrusted input by definition; an unset root must refuse, not allow.
    it("refuses to read anything when unset", async () => {
      delete process.env.FREEAGENT_ATTACHMENTS_DIR;
      await expect(readAttachment(pdf)).rejects.toThrow(/requires FREEAGENT_ATTACHMENTS_DIR/);
    });

    it("refuses to read anything when blank", async () => {
      process.env.FREEAGENT_ATTACHMENTS_DIR = "   ";
      await expect(readAttachment(pdf)).rejects.toThrow(/requires FREEAGENT_ATTACHMENTS_DIR/);
    });

    it("allows a file in a subdirectory of the root", async () => {
      const sub = path.join(dir, "2026");
      await mkdir(sub);
      const inner = path.join(sub, "inner.pdf");
      await writeFile(inner, PDF_BYTES);
      expect((await readAttachment(inner)).file_name).toBe("inner.pdf");
    });

    it("blocks a file outside the root without naming the root", async () => {
      const outside = await mkdtemp(path.join(tmpdir(), "fa-outside-"));
      try {
        const p = path.join(outside, "elsewhere.pdf");
        await writeFile(p, PDF_BYTES);
        await expect(readAttachment(p)).rejects.toThrow(
          /outside the configured attachment directory/
        );
        // The canonical root must not leak: it tells an attacker where the real
        // invoices live.
        await expect(readAttachment(p)).rejects.not.toThrow(new RegExp(escapeRe(dir)));
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    });

    it.skipIf(!canSymlink)("blocks a symlink that escapes the root", async () => {
      const outside = await mkdtemp(path.join(tmpdir(), "fa-outside-"));
      try {
        const target = path.join(outside, "escaped.pdf");
        await writeFile(target, PDF_BYTES);
        const link = path.join(dir, "looks-local.pdf");
        await symlink(target, link);
        await expect(readAttachment(link)).rejects.toThrow(
          /outside the configured attachment directory/
        );
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    });

    it("fails loudly when set to a path that does not exist", async () => {
      process.env.FREEAGENT_ATTACHMENTS_DIR = path.join(dir, "missing");
      await expect(readAttachment(pdf)).rejects.toThrow(/does not exist/);
    });
  });
});

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
