const DEFAULT_BASE_URL = "https://api.freeagent.com/v2";

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

function parseApiError(status: number, body: string): FreeAgentApiError {
  try {
    const parsed = JSON.parse(body);
    const code = parsed?.error ?? parsed?.code ?? "unknown";
    const message =
      parsed?.message ??
      parsed?.error_description ??
      parsed?.errors?.error?.message ??
      `HTTP ${status}`;
    return new FreeAgentApiError(status, code, message);
  } catch {
    return new FreeAgentApiError(status, "unknown", `HTTP ${status} error`);
  }
}

function encodeFormBody(data: Record<string, string>): string {
  return new URLSearchParams(data).toString();
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
      const page = new URL(match[1]).searchParams.get("page");
      return page ? Number(page) : undefined;
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

export class FreeAgentClient {
  private getAccessToken: () => Promise<string>;
  private baseUrl: string;

  constructor(
    tokenOrProvider: string | (() => Promise<string>),
    baseUrl?: string
  ) {
    this.getAccessToken =
      typeof tokenOrProvider === "function"
        ? tokenOrProvider
        : async () => tokenOrProvider;
    this.baseUrl = baseUrl || DEFAULT_BASE_URL;
  }

  async get<T = unknown>(
    path: string,
    params?: Record<string, string>
  ): Promise<T> {
    return this.request<T>("GET", path, undefined, undefined, params);
  }

  async getList<T = unknown>(
    path: string,
    params?: Record<string, string>
  ): Promise<{ data: T; pagination: Pagination }> {
    const { body, headers } = await this.send<T>(
      "GET",
      path,
      undefined,
      undefined,
      params
    );
    return { data: body, pagination: parsePagination(headers, params) };
  }

  async postForm<T = unknown>(
    path: string,
    body?: Record<string, string>
  ): Promise<T> {
    return this.request<T>("POST", path, body, "form");
  }

  async postJson<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body, "json");
  }

  async putForm<T = unknown>(
    path: string,
    body?: Record<string, string>
  ): Promise<T> {
    return this.request<T>("PUT", path, body, "form");
  }

  async putJson<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body, "json");
  }

  async patchJson<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body, "json");
  }

  async deleteReq<T = unknown>(
    path: string,
    params?: Record<string, string>
  ): Promise<T> {
    return this.request<T>("DELETE", path, undefined, undefined, params);
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    bodyType?: "form" | "json",
    params?: Record<string, string>
  ): Promise<T> {
    const { body: responseBody } = await this.send<T>(
      method,
      path,
      body,
      bodyType,
      params
    );
    return responseBody;
  }

  private async send<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    bodyType?: "form" | "json",
    params?: Record<string, string>
  ): Promise<{ body: T; headers: Headers | undefined }> {
    const base = this.baseUrl.endsWith("/") ? this.baseUrl : this.baseUrl + "/";
    const fullPath = path.startsWith("/") ? path.slice(1) : path;

    if (/\.\.[\\/]/.test(fullPath) || /^[a-z]+:\/\//i.test(fullPath)) {
      throw new Error(`Unsafe API path rejected: ${fullPath}`);
    }

    const url = new URL(fullPath, base);
    const baseUrl = new URL(base);

    if (url.origin !== baseUrl.origin) {
      throw new Error(`Resolved URL origin does not match base: ${url.origin}`);
    }

    // The raw-string check above misses encoded dot segments (`%2e%2e/`),
    // which the URL parser still resolves as `..`. Check the resolved path.
    if (!url.pathname.startsWith(baseUrl.pathname)) {
      throw new Error(`Resolved URL escapes the API base path: ${url.pathname}`);
    }

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

    let encodedBody: string | undefined;

    if (body && bodyType === "json") {
      headers["Content-Type"] = "application/json";
      encodedBody = JSON.stringify(body);
    } else if (body && bodyType === "form") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      encodedBody = encodeFormBody(body as Record<string, string>);
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: encodedBody,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw parseApiError(response.status, errorBody);
    }

    const text = await response.text();
    return {
      body: (text ? JSON.parse(text) : {}) as T,
      headers: response.headers,
    };
  }
}
