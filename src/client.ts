const DEFAULT_BASE_URL = "https://api.sandbox.freeagent.com/v2";

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

export class FreeAgentClient {
  private accessToken: string;
  private baseUrl: string;

  constructor(accessToken: string, baseUrl?: string) {
    this.accessToken = accessToken;
    this.baseUrl = baseUrl || DEFAULT_BASE_URL;
  }

  async get<T = unknown>(
    path: string,
    params?: Record<string, string>
  ): Promise<T> {
    return this.request<T>("GET", path, undefined, undefined, params);
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
    const base = this.baseUrl.endsWith("/") ? this.baseUrl : this.baseUrl + "/";
    const fullPath = path.startsWith("/") ? path.slice(1) : path;
    const url = new URL(fullPath, base);

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/json",
      "User-Agent": "freeagent-mcp/1.0.0",
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
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }
}
