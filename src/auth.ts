import { readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { exec } from "node:child_process";
import { randomBytes } from "node:crypto";
import { TOKEN_BUFFER_MS } from "./utils.js";

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
}

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

const TOKEN_DIR = join(homedir(), ".freeagent-mcp");
const TOKEN_FILE = join(TOKEN_DIR, "tokens.json");
const CALLBACK_PORT = 3456;
const AUTH_TIMEOUT_MS = 120_000;

export function getApiBase(sandbox: boolean): string {
  return sandbox
    ? "https://api.sandbox.freeagent.com/v2"
    : "https://api.freeagent.com/v2";
}

export function loadTokens(): StoredTokens | null {
  try {
    const data = readFileSync(TOKEN_FILE, "utf-8");
    return JSON.parse(data) as StoredTokens;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: StoredTokens): void {
  mkdirSync(TOKEN_DIR, { recursive: true });
  writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  try {
    chmodSync(TOKEN_FILE, 0o600);
  } catch {
    // chmod may fail on some platforms, file was already created with mode
  }
}

export function isTokenExpired(tokens: StoredTokens): boolean {
  return Date.now() >= tokens.expires_at - TOKEN_BUFFER_MS;
}

export async function refreshAccessToken(
  config: OAuthConfig,
  refreshToken: string
): Promise<StoredTokens> {
  const base = getApiBase(config.sandbox);
  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString("base64");

  const response = await fetch(`${base}/token_endpoint`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

let refreshPromise: Promise<StoredTokens> | null = null;

export async function getValidAccessToken(
  config: OAuthConfig
): Promise<string> {
  const tokens = loadTokens();
  if (!tokens) {
    throw new Error(
      "No stored tokens found. Run `npx freeagent-mcp-server auth` to authenticate."
    );
  }

  if (!isTokenExpired(tokens)) {
    return tokens.access_token;
  }

  // Mutex: if a refresh is already in flight, wait for it
  if (refreshPromise) {
    const refreshed = await refreshPromise;
    return refreshed.access_token;
  }

  try {
    refreshPromise = refreshAccessToken(config, tokens.refresh_token);
    const newTokens = await refreshPromise;
    saveTokens(newTokens);
    return newTokens.access_token;
  } finally {
    refreshPromise = null;
  }
}

function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? "open"
      : platform === "win32"
        ? "start"
        : "xdg-open";
  exec(`${cmd} "${url}"`);
}

async function exchangeCodeForTokens(
  config: OAuthConfig,
  code: string
): Promise<StoredTokens> {
  const base = getApiBase(config.sandbox);
  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString("base64");

  const response = await fetch(`${base}/token_endpoint`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `http://localhost:${CALLBACK_PORT}/callback`,
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

export async function runAuthFlow(config: OAuthConfig): Promise<void> {
  const state = randomBytes(16).toString("hex");
  const base = getApiBase(config.sandbox);
  const authUrl =
    `${base}/approve_app?response_type=code` +
    `&client_id=${encodeURIComponent(config.clientId)}` +
    `&redirect_uri=${encodeURIComponent(`http://localhost:${CALLBACK_PORT}/callback`)}` +
    `&state=${encodeURIComponent(state)}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Authentication timed out after 120 seconds"));
    }, AUTH_TIMEOUT_MS);

    const server = createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url || "/", `http://localhost:${CALLBACK_PORT}`);

        if (url.pathname !== "/callback") {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const returnedState = url.searchParams.get("state");
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(400);
          res.end(`Authentication failed: ${error}`);
          clearTimeout(timeout);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (returnedState !== state) {
          res.writeHead(400);
          res.end("State mismatch - possible CSRF attack");
          clearTimeout(timeout);
          server.close();
          reject(new Error("OAuth state mismatch"));
          return;
        }

        if (!code) {
          res.writeHead(400);
          res.end("No authorization code received");
          clearTimeout(timeout);
          server.close();
          reject(new Error("No authorization code in callback"));
          return;
        }

        try {
          const tokens = await exchangeCodeForTokens(config, code);
          saveTokens(tokens);

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<html><body><h1>Authentication successful!</h1>" +
              "<p>You can close this window and return to your terminal.</p>" +
              "</body></html>"
          );

          clearTimeout(timeout);
          server.close();
          resolve();
        } catch (err) {
          res.writeHead(500);
          res.end("Token exchange failed");
          clearTimeout(timeout);
          server.close();
          reject(err);
        }
      }
    );

    server.listen(CALLBACK_PORT, () => {
      console.log(`\nOpening browser for FreeAgent authorization...`);
      console.log(`If the browser doesn't open, visit:\n${authUrl}\n`);
      openBrowser(authUrl);
    });
  });
}
