import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

// Tools that can hand account access or company data to someone outside the
// account. Text returned by FreeAgent (bank transaction references, contact
// names, comments) can be written by third parties, so an injected instruction
// must not be able to reach these unless the user has opted in.
export const SENSITIVE_TOOLS = new Set([
  "freeagent_create_user",
  "freeagent_update_user",
  "freeagent_delete_user",
  "freeagent_send_invoice_email",
]);

export function annotationsFor(name: string): ToolAnnotations {
  const action = name.replace(/^freeagent_/, "").split("_")[0];

  if (action === "list" || action === "get") {
    return { readOnlyHint: true, openWorldHint: false };
  }
  if (name === "freeagent_send_invoice_email") {
    return { readOnlyHint: false, destructiveHint: false, openWorldHint: true };
  }
  if (action === "delete" || action === "update" || name === "freeagent_mark_invoice_as_cancelled") {
    return { readOnlyHint: false, destructiveHint: true, openWorldHint: false };
  }
  return { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
}

/**
 * Wraps the server so every tool registered through it gets MCP annotations,
 * and sensitive tools are dropped unless `allowSensitive` is set.
 */
export function withToolPolicy(
  server: McpServer,
  options: { allowSensitive: boolean }
): McpServer {
  const applyPolicy = (name: string, registered: RegisteredTool) => {
    if (SENSITIVE_TOOLS.has(name) && !options.allowSensitive) {
      registered.remove();
      return registered;
    }
    registered.update({ annotations: annotationsFor(name) });
    return registered;
  };

  return new Proxy(server, {
    get(target, prop, receiver) {
      if (prop === "tool" || prop === "registerTool") {
        const original = Reflect.get(target, prop, receiver) as (
          ...args: unknown[]
        ) => RegisteredTool;
        return (...args: unknown[]) =>
          applyPolicy(args[0] as string, original.apply(target, args));
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
