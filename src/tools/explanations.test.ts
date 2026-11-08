import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createMockServer, createMockClient, silenceToolLogs } from "./test-helpers.js";
import { registerExplanationTools } from "./explanations.js";

silenceToolLogs();

const VERSION = { apiVersion: "2026-09-01" };
const TXN = "https://api.freeagent.com/v2/bank_transactions/9";
const ACCOUNT = "https://api.freeagent.com/v2/bank_accounts/1";

function setup() {
  const { server, tools } = createMockServer();
  const client = createMockClient();
  registerExplanationTools(server, client);
  const call = (name: string, args: Record<string, unknown>) =>
    tools.get(`freeagent_${name}`)!(args);
  return { tools, client, call };
}

describe("registerExplanationTools", () => {
  it("registers 8 tools", () => {
    expect(setup().tools.size).toBe(8);
  });

  it("lists explanations for a bank account with the opted-in API version", async () => {
    const { client, call } = setup();
    await call("list_bank_transaction_explanations", { bank_account: ACCOUNT, from_date: "2026-10-01" });
    expect(client.getList).toHaveBeenCalledWith(
      "/bank_transaction_explanations",
      { bank_account: ACCOUNT, from_date: "2026-10-01" },
      VERSION
    );
  });

  it("explains an existing transaction as a bill payment", async () => {
    const { client, call } = setup();
    const res = await call("create_bank_transaction_explanation", {
      bank_transaction: TXN,
      dated_on: "2026-10-03",
      gross_value: "-120.00",
      paid_bill: "https://api.freeagent.com/v2/bills/5",
    });
    expect(res.isError).toBeUndefined();
    expect(client.postJson).toHaveBeenCalledWith(
      "/bank_transaction_explanations",
      {
        bank_transaction_explanation: {
          bank_transaction: TXN,
          dated_on: "2026-10-03",
          gross_value: "-120.00",
          paid_bill: "https://api.freeagent.com/v2/bills/5",
        },
      },
      VERSION
    );
  });

  it("requires exactly one of bank_transaction or bank_account", async () => {
    const { client, call } = setup();
    for (const target of [{}, { bank_transaction: TXN, bank_account: ACCOUNT }]) {
      const res = await call("create_bank_transaction_explanation", { ...target, dated_on: "2026-10-03" });
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toMatch(/exactly one of bank_transaction or bank_account/);
    }
    expect(client.postJson).not.toHaveBeenCalled();
  });

  it("approves a guessed explanation", async () => {
    const { client, call } = setup();
    await call("update_bank_transaction_explanation", {
      explanation_id: "42",
      sales_tax_status: "OUT_OF_SCOPE",
      marked_for_review: false,
    });
    expect(client.putJson).toHaveBeenCalledWith(
      "/bank_transaction_explanations/42",
      { bank_transaction_explanation: { sales_tax_status: "OUT_OF_SCOPE", marked_for_review: false } },
      VERSION
    );
  });

  it("deletes an explanation", async () => {
    const { client, call } = setup();
    await call("delete_bank_transaction_explanation", { explanation_id: "42" });
    expect(client.deleteReq).toHaveBeenCalledWith("/bank_transaction_explanations/42", undefined, VERSION);
  });

  it("removes one attachment by its API URL", async () => {
    const { client, call } = setup();
    await call("remove_bank_transaction_explanation_attachment", { explanation_id: "42", attachment_id: "3" });
    expect(client.putJson).toHaveBeenCalledWith(
      "/bank_transaction_explanations/42/attachments",
      { attachments: [{ url: "https://api.freeagent.com/v2/attachments/3", _destroy: "true" }] },
      VERSION
    );
  });

  it("never returns pre-signed links when listing attachments", async () => {
    const { client, call } = setup();
    (client.get as any).mockResolvedValue({
      attachments: [{ url: "https://api.freeagent.com/v2/attachments/3", content_src: "https://s3.example/x?sig=1" }],
    });
    const res = await call("list_bank_transaction_explanation_attachments", { explanation_id: "42" });
    expect(client.get).toHaveBeenCalledWith("/bank_transaction_explanations/42/attachments", undefined, VERSION);
    expect(res.content[0].text).not.toContain("sig=1");
  });
});

describe("freeagent_add_bank_transaction_explanation_attachments", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "fa-explain-attach-"));
    await writeFile(path.join(dir, "a.pdf"), "%PDF-1.4 a");
    await writeFile(path.join(dir, "b.png"), "png-bytes");
    process.env.FREEAGENT_ATTACHMENTS_DIR = dir;
  });

  afterEach(async () => {
    delete process.env.FREEAGENT_ATTACHMENTS_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it("uploads every file in one request", async () => {
    const { client, call } = setup();
    await call("add_bank_transaction_explanation_attachments", {
      explanation_id: "42",
      attachment_paths: [path.join(dir, "a.pdf"), path.join(dir, "b.png")],
      description: "Receipt",
    });
    expect(client.postJson).toHaveBeenCalledTimes(1);
    const [url, body, options] = (client.postJson as any).mock.calls[0];
    expect(url).toBe("/bank_transaction_explanations/42/attachments");
    expect(options).toEqual(VERSION);
    expect(body.attachments).toEqual([
      {
        data: Buffer.from("%PDF-1.4 a").toString("base64"),
        file_name: "a.pdf",
        content_type: "application/x-pdf",
        description: "Receipt",
      },
      {
        data: Buffer.from("png-bytes").toString("base64"),
        file_name: "b.png",
        content_type: "image/png",
        description: "Receipt",
      },
    ]);
  });

  it("attaches nothing when any file is refused", async () => {
    const { client, call } = setup();
    const res = await call("add_bank_transaction_explanation_attachments", {
      explanation_id: "42",
      attachment_paths: [path.join(dir, "a.pdf"), "/etc/passwd"],
    });
    expect(res.isError).toBe(true);
    expect(client.postJson).not.toHaveBeenCalled();
  });

  it("refuses when FREEAGENT_ATTACHMENTS_DIR is unset", async () => {
    delete process.env.FREEAGENT_ATTACHMENTS_DIR;
    const { client, call } = setup();
    const res = await call("add_bank_transaction_explanation_attachments", {
      explanation_id: "42",
      attachment_paths: [path.join(dir, "a.pdf")],
    });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/FREEAGENT_ATTACHMENTS_DIR/);
    expect(client.postJson).not.toHaveBeenCalled();
  });
});
