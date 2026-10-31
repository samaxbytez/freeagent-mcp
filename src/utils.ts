import { z } from "zod";

export const TOKEN_BUFFER_MS = 60_000;
export const MAX_PAGE_SIZE = 100;
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

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
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
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
      sanitized[k] =
        typeof v === "string" && v.length > 100 ? v.slice(0, 20) + "..." : v;
    }
  }
  console.error(JSON.stringify(sanitized));
}
