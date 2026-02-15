import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  jsonResponse,
  errorResponse,
  buildParams,
  logToolCall,
  TOKEN_BUFFER_MS,
  MAX_PAGE_SIZE,
  CACHE_TTL_MS,
} from "./utils.js";

describe("jsonResponse", () => {
  it("returns correct MCP content structure", () => {
    const result = jsonResponse({ foo: "bar" });
    expect(result).toEqual({
      content: [{ type: "text", text: '{\n  "foo": "bar"\n}' }],
    });
  });

  it("handles nested objects with pretty printing", () => {
    const data = { a: { b: [1, 2] } };
    const result = jsonResponse(data);
    expect(JSON.parse(result.content[0].text)).toEqual(data);
    expect(result.content[0].text).toContain("\n");
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

describe("constants", () => {
  it("has expected values", () => {
    expect(TOKEN_BUFFER_MS).toBe(60_000);
    expect(MAX_PAGE_SIZE).toBe(50);
    expect(CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
});
