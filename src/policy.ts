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
  // A new bank account can carry an attacker's sort code / IBAN and be made primary.
  "freeagent_create_bank_account",
]);

// Fields dropped from an otherwise ordinary tool unless sensitive tools are on.
// Changing an existing customer's email redirects FreeAgent's own invoice and
// reminder emails, so update_contact keeps every field except that one.
export const SENSITIVE_FIELDS: Record<string, string[]> = {
  freeagent_update_contact: ["email"],
};

function withoutFields(schema: unknown, fields: string[]): unknown {
  if (!schema || typeof schema !== "object") return schema;
  return Object.fromEntries(
    Object.entries(schema as Record<string, unknown>).filter(([k]) => !fields.includes(k))
  );
}

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
        return (...args: unknown[]) => {
          const name = args[0] as string;
          const fields = options.allowSensitive ? undefined : SENSITIVE_FIELDS[name];
          if (fields) {
            // server.tool(name, description, schema, cb) or
            // server.registerTool(name, { inputSchema }, cb). The schema is a zod
            // raw shape, so a dropped field is stripped from every call.
            if (prop === "tool" && typeof args[3] === "function") {
              args[2] = withoutFields(args[2], fields);
            } else if (prop === "registerTool") {
              const config = args[1] as { inputSchema?: unknown };
              args[1] = { ...config, inputSchema: withoutFields(config.inputSchema, fields) };
            }
          }
          return applyPolicy(name, original.apply(target, args));
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
