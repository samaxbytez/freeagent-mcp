import { vi, beforeEach, afterEach } from "vitest";
import type { FreeAgentClient } from "../client.js";

export type ToolHandler = (...args: any[]) => any;

/** A stand-in McpServer that records each tool's handler by name. */
export function createMockServer() {
  const tools = new Map<string, ToolHandler>();
  return {
    server: {
      // server.registerTool(name, config, handler)
      registerTool: vi.fn((name: string, _config: unknown, cb: ToolHandler) => {
        tools.set(name, cb);
      }),
      // server.tool(name, desc, handler) or server.tool(name, desc, schema, handler)
      tool: vi.fn((...args: any[]) => {
        const name = args[0] as string;
        const cb = typeof args[2] === "function" ? args[2] : args[3];
        tools.set(name, cb);
      }),
    } as any,
    tools,
  };
}

export function createMockClient() {
  return {
    get: vi.fn().mockResolvedValue({ data: "mock" }),
    getList: vi.fn().mockResolvedValue({ data: { data: "mock" }, pagination: { page: 1, per_page: 25 } }),
    postJson: vi.fn().mockResolvedValue({ data: "mock" }),
    putJson: vi.fn().mockResolvedValue({ data: "mock" }),
    deleteReq: vi.fn().mockResolvedValue({ data: "mock" }),
  } as unknown as FreeAgentClient;
}

/** Silences logToolCall's stderr output for the calling test file. */
export function silenceToolLogs() {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });
}
