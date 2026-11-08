const DEFAULT_BASE_URL = "https://api.freeagent.com/v2";
export const REQUEST_TIMEOUT_MS = 30_000;

export class FreeAgentApiError extends Error {
  public readonly status: number;
  public readonly errorCode: string;

  constructor(status: number, errorCode: string, message: string) {
    super(`FreeAgent API error (${status}): ${errorCode} - ${message}`);
    this.name = "FreeAgentApiError";
    this.status = status;
    this.errorCode = errorCode;
  }
}

function parseApiError(response: Response, body: string): FreeAgentApiError {
  const { status } = response;
  if (status === 429) {
    const retryAfter = response.headers?.get("retry-after");
    return new FreeAgentApiError(
      status,
      "rate_limited",
      `FreeAgent rate limit reached${retryAfter ? `; retry after ${retryAfter} seconds` : ""}`
    );
  }
  try {
    const parsed = JSON.parse(body);
    const code = parsed?.error ?? parsed?.code ?? "unknown";
    // Validation errors come as {errors: {error: {message}}} for one problem and
    // {errors: [{message}, ...]} for several; keep every message so the model
    // can correct its call.
    const listed = Array.isArray(parsed?.errors)
      ? parsed.errors.map((e: { message?: string }) => e?.message).filter(Boolean).join("; ")
      : undefined;
    const message =
      parsed?.message ??
      parsed?.error_description ??
      parsed?.errors?.error?.message ??
      (listed || `HTTP ${status}`);
    return new FreeAgentApiError(status, code, message);
  } catch {
    // Not JSON (e.g. a proxy's HTML page): don't echo it to the model.
    return new FreeAgentApiError(status, "unknown", `HTTP ${status} error`);
  }
}

export interface Pagination {
  page: number;
  per_page: number;
  total_count?: number;
  next_page?: number;
  last_page?: number;
}

function pageFromLink(link: string, rel: string): number | undefined {
  for (const part of link.split(",")) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?([a-z]+)"?/i);
    if (match && match[2] === rel) {
      // Relative to the API base if FreeAgent ever sends a relative link; a
      // malformed one just means no page number, not a failed list call.
      try {
        const page = new URL(match[1], "https://api.freeagent.com/").searchParams.get("page");
        return page ? Number(page) : undefined;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

// FreeAgent signals further pages via the Link header and the total via
// X-Total-Count; without surfacing these, list results look complete when
// they are only the first page.
export function parsePagination(
  headers: Headers | undefined,
  params: Record<string, string> | undefined
): Pagination {
  const pagination: Pagination = {
    page: Number(params?.page ?? 1),
    per_page: Number(params?.per_page ?? 25),
  };
  const total = headers?.get("x-total-count");
  if (total) pagination.total_count = Number(total);
  const link = headers?.get("link");
  if (link) {
    const next = pageFromLink(link, "next");
    const last = pageFromLink(link, "last");
    if (next !== undefined) pagination.next_page = next;
    if (last !== undefined) pagination.last_page = last;
  }
  return pagination;
}

export interface RequestOptions {
  /** Opt in to a dated FreeAgent API version (sent as X-Api-Version), e.g. "2026-09-01". */
  apiVersion?: string;
}

interface SendOptions extends RequestOptions {
  body?: unknown;
  params?: Record<string, string>;
}

const API_VERSION = /^\d{4}-\d{2}-\d{2}$/;

export class FreeAgentClient {
  private getAccessToken: () => Promise<string>;
  private base: URL;

  constructor(
    tokenOrProvider: string | (() => Promise<string>),
    baseUrl?: string
  ) {
    this.getAccessToken =
      typeof tokenOrProvider === "function"
        ? tokenOrProvider
        : async () => tokenOrProvider;
    const base = baseUrl || DEFAULT_BASE_URL;
    this.base = new URL(base.endsWith("/") ? base : base + "/");
  }

  async get<T = unknown>(
    path: string,
    params?: Record<string, string>,
    options?: RequestOptions
  ): Promise<T> {
    return (await this.send<T>("GET", path, { ...options, params })).body;
  }

  async getList<T = unknown>(
    path: string,
    params?: Record<string, string>,
    options?: RequestOptions
  ): Promise<{ data: T; pagination: Pagination }> {
    const { body, headers } = await this.send<T>("GET", path, { ...options, params });
    return { data: body, pagination: parsePagination(headers, params) };
  }

  async postJson<T = unknown>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return (await this.send<T>("POST", path, { ...options, body })).body;
  }

  async putJson<T = unknown>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return (await this.send<T>("PUT", path, { ...options, body })).body;
  }

  async deleteReq<T = unknown>(
    path: string,
    params?: Record<string, string>,
    options?: RequestOptions
  ): Promise<T> {
    return (await this.send<T>("DELETE", path, { ...options, params })).body;
  }

  /**
   * The absolute API URL of a resource, for request bodies that refer to one by URL
   * (e.g. an attachment to remove). Runs the same path checks as a request.
   */
  resourceUrl(path: string): string {
    return this.resolve(path).toString();
  }

  private resolve(path: string): URL {
    const fullPath = path.startsWith("/") ? path.slice(1) : path;

    if (/\.\.[\\/]/.test(fullPath) || /^[a-z]+:\/\//i.test(fullPath)) {
      throw new Error(`Unsafe API path rejected: ${fullPath}`);
    }

    const url = new URL(fullPath, this.base);

    if (url.origin !== this.base.origin) {
      throw new Error(`Resolved URL origin does not match base: ${url.origin}`);
    }

    // The raw-string check above misses encoded dot segments (`%2e%2e/`),
    // which the URL parser still resolves as `..`. Check the resolved path.
    if (!url.pathname.startsWith(this.base.pathname)) {
      throw new Error(`Resolved URL escapes the API base path: ${url.pathname}`);
    }
    return url;
  }

  private async send<T = unknown>(
    method: string,
    path: string,
    { body, params, apiVersion }: SendOptions = {}
  ): Promise<{ body: T; headers: Headers | undefined }> {
    const url = this.resolve(path);

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const accessToken = await this.getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": "freeagent-mcp-server",
    };

    if (body) headers["Content-Type"] = "application/json";
    if (apiVersion !== undefined) {
      if (!API_VERSION.test(apiVersion)) throw new Error(`Invalid API version: ${apiVersion}`);
      headers["X-Api-Version"] = apiVersion;
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      // A stalled connection would otherwise leave the tool call pending forever.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw parseApiError(response, await response.text());
    }

    const text = await response.text();
    return {
      body: (text ? JSON.parse(text) : {}) as T,
      headers: response.headers,
    };
  }
}
