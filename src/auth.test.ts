import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  loadTokens,
  saveTokens,
  isTokenExpired,
  refreshAccessToken,
  getValidAccessToken,
  getApiBase,
  type StoredTokens,
  type OAuthConfig,
} from "./auth.js";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  chmodSync: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/mock-home"),
}));

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockMkdirSync = vi.mocked(mkdirSync);

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const testConfig: OAuthConfig = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  sandbox: true,
};

const validTokens: StoredTokens = {
  access_token: "valid-token",
  refresh_token: "refresh-token",
  expires_at: Date.now() + 3_600_000, // 1 hour from now
};

const expiredTokens: StoredTokens = {
  access_token: "expired-token",
  refresh_token: "refresh-token",
  expires_at: Date.now() - 1000, // already expired
};

describe("getApiBase", () => {
  it("returns sandbox URL when sandbox is true", () => {
    expect(getApiBase(true)).toBe("https://api.sandbox.freeagent.com/v2");
  });

  it("returns production URL when sandbox is false", () => {
    expect(getApiBase(false)).toBe("https://api.freeagent.com/v2");
  });
});

describe("loadTokens", () => {
  it("returns parsed tokens from file", () => {
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(validTokens));
    const tokens = loadTokens();
    expect(tokens).toEqual(validTokens);
  });

  it("returns null when file does not exist", () => {
    mockReadFileSync.mockImplementationOnce(() => {
      throw new Error("ENOENT");
    });
    expect(loadTokens()).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    mockReadFileSync.mockReturnValueOnce("not json");
    expect(loadTokens()).toBeNull();
  });
});

describe("saveTokens", () => {
  it("creates directory and writes token file", () => {
    saveTokens(validTokens);
    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.stringContaining(".freeagent-mcp"),
      { recursive: true }
    );
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining("tokens.json"),
      JSON.stringify(validTokens, null, 2),
      { mode: 0o600 }
    );
  });
});

describe("isTokenExpired", () => {
  it("returns false for valid tokens", () => {
    expect(isTokenExpired(validTokens)).toBe(false);
  });

  it("returns true for expired tokens", () => {
    expect(isTokenExpired(expiredTokens)).toBe(true);
  });

  it("returns true when within buffer window", () => {
    const almostExpired: StoredTokens = {
      ...validTokens,
      expires_at: Date.now() + 30_000, // 30s, within 60s buffer
    };
    expect(isTokenExpired(almostExpired)).toBe(true);
  });
});

describe("refreshAccessToken", () => {
  it("exchanges refresh token for new tokens", async () => {
    const newTokenData = {
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
      expires_in: 7200,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => newTokenData,
    } as Response);

    const result = await refreshAccessToken(testConfig, "old-refresh-token");

    expect(result.access_token).toBe("new-access-token");
    expect(result.refresh_token).toBe("new-refresh-token");
    expect(result.expires_at).toBeGreaterThan(Date.now());

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("api.sandbox.freeagent.com/v2/token_endpoint");
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toMatch(/^Basic /);
    expect(opts.body).toContain("grant_type=refresh_token");
    expect(opts.body).toContain("refresh_token=old-refresh-token");
  });

  it("throws on failed refresh", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "invalid_grant",
    } as Response);

    await expect(
      refreshAccessToken(testConfig, "bad-token")
    ).rejects.toThrow("Token refresh failed (401)");
  });

  it("uses production URL when sandbox is false", async () => {
    const prodConfig = { ...testConfig, sandbox: false };
    const newTokenData = {
      access_token: "new-token",
      refresh_token: "new-refresh",
      expires_in: 3600,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => newTokenData,
    } as Response);

    await refreshAccessToken(prodConfig, "refresh-token");

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("api.freeagent.com/v2/token_endpoint");
    expect(url).not.toContain("sandbox");
  });
});

describe("getValidAccessToken", () => {
  it("returns token directly when not expired", async () => {
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(validTokens));
    const token = await getValidAccessToken(testConfig);
    expect(token).toBe("valid-token");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("refreshes and returns new token when expired", async () => {
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(expiredTokens));

    const newTokenData = {
      access_token: "refreshed-token",
      refresh_token: "new-refresh",
      expires_in: 3600,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => newTokenData,
    } as Response);

    const token = await getValidAccessToken(testConfig);
    expect(token).toBe("refreshed-token");
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("throws when no stored tokens exist", async () => {
    mockReadFileSync.mockImplementationOnce(() => {
      throw new Error("ENOENT");
    });

    await expect(getValidAccessToken(testConfig)).rejects.toThrow(
      "No stored tokens found"
    );
  });
});
