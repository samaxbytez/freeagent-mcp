import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  jsonResponse,
  errorResponse,
  buildParams,
  listResponse,
  logToolCall,
  safeId,
  TOKEN_BUFFER_MS,
  MAX_PAGE_SIZE,
} from "./utils.js";

describe("jsonResponse", () => {
  it("returns correct MCP content structure", () => {
    const result = jsonResponse({ foo: "bar" });
    expect(result).toEqual({
      content: [{ type: "text", text: '{"foo":"bar"}' }],
    });
  });

  it("serialises nested objects compactly", () => {
    const data = { a: { b: [1, 2] } };
    const result = jsonResponse(data);
    expect(result.content[0].text).toBe('{"a":{"b":[1,2]}}');
  });
});

describe("jsonResponse redaction", () => {
  it("removes pre-signed attachment download links at any depth", () => {
    const text = jsonResponse({
      expense: {
        attachment: {
          file_name: "receipt.pdf",
          content_src: "https://s3.example/receipt.pdf?X-Amz-Signature=abc",
          content_src_medium: "https://s3.example/m?sig",
        },
      },
    }).content[0].text;
    expect(text).not.toContain("X-Amz-Signature");
    expect(text).not.toContain("s3.example");
    expect(JSON.parse(text).expense.attachment.file_name).toBe("receipt.pdf");
  });
});

describe("errorResponse", () => {
  it("formats Error instances using .message", () => {
    const result = errorResponse(new Error("something went wrong"));
    expect(result).toEqual({
      content: [{ type: "text", text: "Error: something went wrong" }],
      isError: true,
    });
  });

  it("formats non-Error values using String()", () => {
    expect(errorResponse("plain string").content[0].text).toBe(
      "Error: plain string"
    );
    expect(errorResponse(42).content[0].text).toBe("Error: 42");
  });
});

describe("buildParams", () => {
  it("includes defined values and converts to strings", () => {
    expect(buildParams({ a: "x", b: 5, c: true })).toEqual({
      a: "x",
      b: "5",
      c: "true",
    });
  });

  it("strips undefined and null values", () => {
    expect(buildParams({ a: "x", b: undefined, c: null, d: "y" })).toEqual({
      a: "x",
      d: "y",
    });
  });
});

describe("logToolCall", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("outputs JSON to stderr with ts and tool fields", () => {
    logToolCall("test_tool", { key: "value" });
    expect(errorSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(logged).toHaveProperty("ts");
    expect(logged.tool).toBe("test_tool");
    expect(logged.key).toBe("value");
  });

  it("truncates long string params to 20 chars", () => {
    const longValue = "a".repeat(200);
    logToolCall("test", { secret: longValue });
    const logged = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(logged.secret).toBe("a".repeat(20) + "...");
  });
});

describe("safeId", () => {
  it("accepts numeric IDs", () => {
    expect(safeId.parse("12345")).toBe("12345");
  });

  it("accepts alphanumeric IDs with hyphens and underscores", () => {
    expect(safeId.parse("abc-123_DEF")).toBe("abc-123_DEF");
  });

  it("rejects path traversal sequences", () => {
    expect(() => safeId.parse("../../users/me")).toThrow();
  });

  it("rejects IDs with slashes", () => {
    expect(() => safeId.parse("123/456")).toThrow();
  });

  it("rejects IDs with query strings", () => {
    expect(() => safeId.parse("123?admin=true")).toThrow();
  });

  it("rejects empty strings", () => {
    expect(() => safeId.parse("")).toThrow();
  });

  it("rejects URLs", () => {
    expect(() => safeId.parse("https://evil.com")).toThrow();
  });
});

describe("constants", () => {
  it("has expected values", () => {
    expect(TOKEN_BUFFER_MS).toBe(60_000);
    expect(MAX_PAGE_SIZE).toBe(100);
  });
});

describe("listResponse", () => {
  it("merges pagination into the resource object", () => {
    const result = listResponse({
      data: { invoices: [{ id: 1 }] },
      pagination: { page: 1, per_page: 25, next_page: 2 },
    });
    expect(JSON.parse(result.content[0].text)).toEqual({
      invoices: [{ id: 1 }],
      pagination: { page: 1, per_page: 25, next_page: 2 },
    });
  });
});
