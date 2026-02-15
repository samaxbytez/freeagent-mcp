import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FreeAgentClient, FreeAgentApiError } from "./client.js";

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockOk(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  } as Response;
}

function mockError(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    text: async () =>
      typeof body === "string" ? body : JSON.stringify(body),
  } as Response;
}

describe("FreeAgentClient - GET", () => {
  it("sends Authorization header", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ data: "ok" }));
    const client = new FreeAgentClient("test-token");
    await client.get("/v2/test");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/v2/test");
    expect(opts.headers.Authorization).toBe("Bearer test-token");
  });

  it("sends Accept and User-Agent headers", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ data: "ok" }));
    const client = new FreeAgentClient("token");
    await client.get("/v2/test");

    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    expect((opts.headers as Record<string, string>).Accept).toBe(
      "application/json"
    );
    expect((opts.headers as Record<string, string>)["User-Agent"]).toBe(
      "freeagent-mcp/1.0.0"
    );
  });

  it("appends query params", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ data: "ok" }));
    const client = new FreeAgentClient("token");
    await client.get("/v2/test", { foo: "bar", limit: "10" });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("foo=bar");
    expect(url).toContain("limit=10");
  });

  it("uses default sandbox base URL", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ data: "ok" }));
    const client = new FreeAgentClient("token");
    await client.get("/v2/company");

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("api.sandbox.freeagent.com");
  });

  it("uses custom base URL when provided", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ data: "ok" }));
    const client = new FreeAgentClient(
      "token",
      "https://api.freeagent.com/v2"
    );
    await client.get("/v2/company");

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("api.freeagent.com");
    expect(url).not.toContain("sandbox");
  });

  it("handles empty response body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "",
    } as Response);
    const client = new FreeAgentClient("token");
    const result = await client.get("/v2/test");
    expect(result).toEqual({});
  });
});

describe("FreeAgentClient - POST", () => {
  it("sends JSON body for postJson", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ data: "ok" }));
    const client = new FreeAgentClient("token");
    await client.postJson("/v2/test", { invoice: { amount: 100 } });

    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    expect(opts.method).toBe("POST");
    expect(
      (opts.headers as Record<string, string>)["Content-Type"]
    ).toBe("application/json");
    expect(opts.body).toBe('{"invoice":{"amount":100}}');
  });

  it("sends form body for postForm", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ data: "ok" }));
    const client = new FreeAgentClient("token");
    await client.postForm("/v2/test", { key: "value" });

    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    expect(
      (opts.headers as Record<string, string>)["Content-Type"]
    ).toBe("application/x-www-form-urlencoded");
    expect(opts.body).toBe("key=value");
  });
});

describe("FreeAgentClient - PUT", () => {
  it("sends JSON body for putJson", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ data: "ok" }));
    const client = new FreeAgentClient("token");
    await client.putJson("/v2/test/123", { contact: { name: "Sam" } });

    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    expect(opts.method).toBe("PUT");
    expect(
      (opts.headers as Record<string, string>)["Content-Type"]
    ).toBe("application/json");
  });
});

describe("FreeAgentClient - DELETE", () => {
  it("sends DELETE request", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({}));
    const client = new FreeAgentClient("token");
    await client.deleteReq("/v2/test/123");

    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    expect(opts.method).toBe("DELETE");
  });
});

describe("FreeAgentClient - token provider", () => {
  it("accepts an async function as token provider", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ data: "ok" }));
    const provider = async () => "dynamic-token";
    const client = new FreeAgentClient(provider);
    await client.get("/v2/test");

    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    expect((opts.headers as Record<string, string>).Authorization).toBe(
      "Bearer dynamic-token"
    );
  });

  it("calls provider on each request", async () => {
    let callCount = 0;
    const provider = async () => `token-${++callCount}`;
    const client = new FreeAgentClient(provider);

    mockFetch.mockResolvedValueOnce(mockOk({ data: "ok" }));
    await client.get("/v2/test1");

    mockFetch.mockResolvedValueOnce(mockOk({ data: "ok" }));
    await client.get("/v2/test2");

    const opts1 = mockFetch.mock.calls[0][1] as RequestInit;
    const opts2 = mockFetch.mock.calls[1][1] as RequestInit;
    expect((opts1.headers as Record<string, string>).Authorization).toBe(
      "Bearer token-1"
    );
    expect((opts2.headers as Record<string, string>).Authorization).toBe(
      "Bearer token-2"
    );
  });

  it("still works with a plain string token", async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ data: "ok" }));
    const client = new FreeAgentClient("static-token");
    await client.get("/v2/test");

    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    expect((opts.headers as Record<string, string>).Authorization).toBe(
      "Bearer static-token"
    );
  });
});

describe("FreeAgentClient - error handling", () => {
  it("throws FreeAgentApiError with parsed fields", async () => {
    mockFetch.mockResolvedValueOnce(
      mockError(400, { error: "invalid_param", message: "bad request" })
    );

    const client = new FreeAgentClient("token");
    try {
      await client.get("/v2/test");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(FreeAgentApiError);
      const err = e as FreeAgentApiError;
      expect(err.status).toBe(400);
      expect(err.errorCode).toBe("invalid_param");
    }
  });

  it("handles nested error format", async () => {
    mockFetch.mockResolvedValueOnce(
      mockError(422, {
        errors: { error: { message: "Contact is required" } },
      })
    );

    const client = new FreeAgentClient("token");
    try {
      await client.get("/v2/test");
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as FreeAgentApiError;
      expect(err.status).toBe(422);
    }
  });

  it("returns safe fallback for malformed error body", async () => {
    mockFetch.mockResolvedValueOnce(mockError(500, "not json"));

    const client = new FreeAgentClient("token");
    try {
      await client.get("/v2/test");
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as FreeAgentApiError;
      expect(err.errorCode).toBe("unknown");
      expect(err.message).not.toContain("not json");
    }
  });
});
