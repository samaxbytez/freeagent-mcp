import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FreeAgentClient } from "../client.js";
import { registerCompanyTools } from "./company.js";
import { registerContactTools } from "./contacts.js";
import { registerInvoiceTools } from "./invoices.js";
import { registerExpenseTools } from "./expenses.js";
import { registerBankingTools } from "./banking.js";
import { registerAccountingTools } from "./accounting.js";

type ToolHandler = (...args: any[]) => any;

function createMockServer() {
  const tools = new Map<string, ToolHandler>();
  return {
    server: {
      // New API: server.registerTool(name, config, handler)
      registerTool: vi.fn(
        (name: string, _config: unknown, cb: ToolHandler) => {
          tools.set(name, cb);
        }
      ),
      // Old convenience API: server.tool(name, desc, handler) or server.tool(name, desc, schema, handler)
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
    postForm: vi.fn().mockResolvedValue({ data: "mock" }),
    putForm: vi.fn().mockResolvedValue({ data: "mock" }),
    patchJson: vi.fn().mockResolvedValue({ data: "mock" }),
    deleteReq: vi.fn().mockResolvedValue({ data: "mock" }),
  } as unknown as FreeAgentClient;
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("registerCompanyTools", () => {
  it("registers 3 tools", () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerCompanyTools(server, client);
    expect(tools.size).toBe(3);
  });

  it("freeagent_get_company calls client.get and returns jsonResponse", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerCompanyTools(server, client);

    const handler = tools.get("freeagent_get_company")!;
    const result = await handler({});

    expect(client.get).toHaveBeenCalledWith("/company");
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ data: "mock" });
  });

  it("returns errorResponse when client throws", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    (client.get as any).mockRejectedValue(new Error("connection failed"));
    registerCompanyTools(server, client);

    const handler = tools.get("freeagent_get_company")!;
    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Error: connection failed");
  });
});

describe("registerContactTools", () => {
  it("registers 5 tools", () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerContactTools(server, client);
    expect(tools.size).toBe(5);
  });

  it("freeagent_list_contacts passes view param", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerContactTools(server, client);

    const handler = tools.get("freeagent_list_contacts")!;
    await handler({ view: "active" });

    expect(client.get).toHaveBeenCalledWith(
      "/contacts",
      expect.objectContaining({ view: "active" })
    );
  });

  it("freeagent_create_contact sends wrapped body", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerContactTools(server, client);

    const handler = tools.get("freeagent_create_contact")!;
    await handler({ first_name: "John", last_name: "Doe" });

    expect(client.postJson).toHaveBeenCalledWith(
      "/contacts",
      expect.objectContaining({
        contact: expect.objectContaining({
          first_name: "John",
          last_name: "Doe",
        }),
      })
    );
  });

  it("freeagent_delete_contact calls deleteReq", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerContactTools(server, client);

    const handler = tools.get("freeagent_delete_contact")!;
    await handler({ contact_id: "123" });

    expect(client.deleteReq).toHaveBeenCalledWith("/contacts/123");
  });
});

describe("registerInvoiceTools", () => {
  it("registers 9 tools", () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerInvoiceTools(server, client);
    expect(tools.size).toBe(9);
  });

  it("freeagent_mark_invoice_as_sent calls putJson with transition path", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerInvoiceTools(server, client);

    const handler = tools.get("freeagent_mark_invoice_as_sent")!;
    await handler({ invoice_id: "456" });

    expect(client.putJson).toHaveBeenCalledWith(
      "/invoices/456/transitions/mark_as_sent",
      {}
    );
  });
});

describe("registerExpenseTools", () => {
  it("registers 5 tools", () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerExpenseTools(server, client);
    expect(tools.size).toBe(5);
  });

  it("freeagent_create_expense sends wrapped body", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerExpenseTools(server, client);

    const handler = tools.get("freeagent_create_expense")!;
    await handler({
      user: "https://api.freeagent.com/v2/users/1",
      category: "https://api.freeagent.com/v2/categories/285",
      dated_on: "2024-01-15",
      gross_value: "50.00",
    });

    expect(client.postJson).toHaveBeenCalledWith(
      "/expenses",
      expect.objectContaining({
        expense: expect.objectContaining({
          user: "https://api.freeagent.com/v2/users/1",
          gross_value: "50.00",
        }),
      })
    );
  });
});

describe("registerBankingTools", () => {
  it("registers 7 tools", () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerBankingTools(server, client);
    expect(tools.size).toBe(7);
  });

  it("freeagent_list_bank_transactions requires bank_account param", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerBankingTools(server, client);

    const handler = tools.get("freeagent_list_bank_transactions")!;
    await handler({
      bank_account: "https://api.freeagent.com/v2/bank_accounts/1",
    });

    expect(client.get).toHaveBeenCalledWith(
      "/bank_transactions",
      expect.objectContaining({
        bank_account: "https://api.freeagent.com/v2/bank_accounts/1",
      })
    );
  });
});

describe("registerAccountingTools", () => {
  it("registers 5 tools", () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerAccountingTools(server, client);
    expect(tools.size).toBe(5);
  });

  it("freeagent_get_profit_and_loss passes date params", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerAccountingTools(server, client);

    const handler = tools.get("freeagent_get_profit_and_loss")!;
    await handler({ from_date: "2024-01-01", to_date: "2024-12-31" });

    expect(client.get).toHaveBeenCalledWith(
      "/accounting/profit_and_loss/summary",
      expect.objectContaining({
        from_date: "2024-01-01",
        to_date: "2024-12-31",
      })
    );
  });

  it("freeagent_get_balance_sheet passes as_at_date", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerAccountingTools(server, client);

    const handler = tools.get("freeagent_get_balance_sheet")!;
    await handler({ as_at_date: "2024-06-30" });

    expect(client.get).toHaveBeenCalledWith(
      "/accounting/balance_sheet",
      expect.objectContaining({ as_at_date: "2024-06-30" })
    );
  });
});
