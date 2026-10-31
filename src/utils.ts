import { z } from "zod";

export const TOKEN_BUFFER_MS = 60_000;
export const MAX_PAGE_SIZE = 100;

export const safeId = z.string().regex(/^[a-zA-Z0-9_-]+$/, "ID must contain only alphanumeric characters, hyphens, and underscores");

export const paginationParams = {
  page: z.number().int().min(1).optional().describe("Page number to fetch (default 1)"),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .optional()
    .describe(`Results per page (default 25, max ${MAX_PAGE_SIZE}). Check pagination.next_page in the response for more results.`),
};

export function jsonResponse(data: unknown) {
  return {
    // Compact: indentation adds 20-40% to large payloads, all of it model tokens.
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  };
}

export function listResponse(result: { data: unknown; pagination: unknown }) {
  const { data, pagination } = result;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return jsonResponse({ ...data, pagination });
  }
  return jsonResponse({ data, pagination });
}

export function errorResponse(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${msg}` }],
    isError: true,
  };
}

/** Copies obj without its undefined values, for request bodies built from optional args. */
export function definedOnly(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export function buildParams(
  obj: Record<string, unknown>
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) params[k] = String(v);
  }
  return params;
}

export function logToolCall(tool: string, params?: Record<string, unknown>) {
  const sanitized: Record<string, unknown> = {
    ts: new Date().toISOString(),
    tool,
  };
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      // attachment_path is the audit record of which local file was read, so a long
      // path truncated to 20 chars ("C:\Users\ChrisCoomb...") would defeat the point.
      // It is a filename, not a secret. Exempt only this key, not a whole naming class,
      // and still cap it so an oversized argument cannot flood the log.
      const [max, keep] = k === "attachment_path" ? [500, 500] : [100, 20];
      sanitized[k] =
        typeof v === "string" && v.length > max ? v.slice(0, keep) + "..." : v;
    }
  }
  console.error(JSON.stringify(sanitized));
}
