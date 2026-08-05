import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FreeAgentClient } from "../client.js";
import { registerExpenseTools } from "./expenses.js";
import { registerBillTools } from "./bills.js";

type ToolHandler = (...args: any[]) => any;

function createMockServer() {
  const tools = new Map<string, ToolHandler>();
  return {
    server: {
      registerTool: vi.fn((name: string, _config: unknown, cb: ToolHandler) => {
        tools.set(name, cb);
      }),
      tool: vi.fn((...args: any[]) => {
        const name = args[0] as string;
        const cb = typeof args[2] === "function" ? args[2] : args[3];
        tools.set(name, cb);
      }),
    } as any,
    tools,
  };
}

function createMockClient() {
  return {
    get: vi.fn().mockResolvedValue({ data: "mock" }),
    postJson: vi.fn().mockResolvedValue({ data: "mock" }),
    putJson: vi.fn().mockResolvedValue({ data: "mock" }),
    deleteReq: vi.fn().mockResolvedValue({ data: "mock" }),
  } as unknown as FreeAgentClient;
}

const PDF_BYTES = Buffer.from("%PDF-1.4 receipt", "utf8");

let dir: string;
let pdf: string;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  dir = await mkdtemp(path.join(tmpdir(), "fa-tools-attach-"));
  pdf = path.join(dir, "invoice.pdf");
  await writeFile(pdf, PDF_BYTES);
  // readAttachment is default-deny; without a root every attach below would fail.
  process.env.FREEAGENT_ATTACHMENTS_DIR = dir;
});

afterEach(async () => {
  errorSpy.mockRestore();
  delete process.env.FREEAGENT_ATTACHMENTS_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("attachment_path on expense tools", () => {
  it("create_expense sends the attachment in the SAME request as the expense", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerExpenseTools(server, client);

    await tools.get("freeagent_create_expense")!({
      user: "https://api.freeagent.com/v2/users/1",
      category: "https://api.freeagent.com/v2/categories/270",
      dated_on: "2026-08-05",
      gross_value: "189.99",
      attachment_path: pdf,
    });

    expect(client.postJson).toHaveBeenCalledTimes(1);
    const [url, body] = (client.postJson as any).mock.calls[0];
    expect(url).toBe("/expenses");
    expect(body.expense.attachment).toEqual({
      data: PDF_BYTES.toString("base64"),
      file_name: "invoice.pdf",
      content_type: "application/pdf",
    });
    // The raw path must never reach the API as a field.
    expect(body.expense.attachment_path).toBeUndefined();
  });

  it("create_expense omits attachment entirely when no path is given", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerExpenseTools(server, client);

    await tools.get("freeagent_create_expense")!({
      user: "https://api.freeagent.com/v2/users/1",
      category: "https://api.freeagent.com/v2/categories/270",
      dated_on: "2026-08-05",
      gross_value: "189.99",
    });

    const [, body] = (client.postJson as any).mock.calls[0];
    expect("attachment" in body.expense).toBe(false);
  });

  it("update_expense attaches without disturbing other fields", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerExpenseTools(server, client);

    await tools.get("freeagent_update_expense")!({
      expense_id: "64663146",
      attachment_path: pdf,
    });

    const [url, body] = (client.putJson as any).mock.calls[0];
    expect(url).toBe("/expenses/64663146");
    expect(body.expense.attachment.file_name).toBe("invoice.pdf");
    expect(body.expense.attachment_path).toBeUndefined();
  });

  it("surfaces a rejected attachment as an error and sends NOTHING", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerExpenseTools(server, client);

    const txt = path.join(dir, "notes.txt");
    await writeFile(txt, PDF_BYTES);

    const res = await tools.get("freeagent_create_expense")!({
      user: "https://api.freeagent.com/v2/users/1",
      category: "https://api.freeagent.com/v2/categories/270",
      dated_on: "2026-08-05",
      gross_value: "189.99",
      attachment_path: txt,
    });

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/does not accept/);
    // The whole point of doing this in one request: a rejected receipt means no expense.
    expect(client.postJson).not.toHaveBeenCalled();
  });
});

describe("attachment_path on bill tools", () => {
  it("create_bill sends the attachment alongside the bill items", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerBillTools(server, client);

    await tools.get("freeagent_create_bill")!({
      contact: "https://api.freeagent.com/v2/contacts/1",
      reference: "INV-1",
      dated_on: "2026-08-05",
      due_on: "2026-09-05",
      bill_items: '[{"category":"https://api.freeagent.com/v2/categories/270","total_value":"10.00"}]',
      attachment_path: pdf,
    });

    const [url, body] = (client.postJson as any).mock.calls[0];
    expect(url).toBe("/bills");
    expect(body.bill.attachment.file_name).toBe("invoice.pdf");
    expect(body.bill.attachment_path).toBeUndefined();
  });

  // update_bill spreads ...rest into the request body. Without destructuring
  // attachment_path out by name, the raw local path would be POSTed as a bill field.
  it("update_bill does not leak the raw path into the body via ...rest", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerBillTools(server, client);

    await tools.get("freeagent_update_bill")!({
      bill_id: "123",
      reference: "INV-2",
      attachment_path: pdf,
    });

    const [url, body] = (client.putJson as any).mock.calls[0];
    expect(url).toBe("/bills/123");
    expect(body.bill.attachment_path).toBeUndefined();
    expect(body.bill.attachment.file_name).toBe("invoice.pdf");
    expect(body.bill.reference).toBe("INV-2");
  });
});
