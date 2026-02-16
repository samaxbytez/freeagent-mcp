import { readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createInterface } from "node:readline";
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

export function parseCallbackUrl(
  input: string,
  expectedState: string
): { code: string } | { error: string } {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { error: "Not a valid URL" };
  }

  const error = url.searchParams.get("error");
  if (error) return { error: `OAuth error: ${error}` };

  const code = url.searchParams.get("code");
  if (!code) return { error: "No authorization code found in URL" };

  const returnedState = url.searchParams.get("state");
  if (returnedState !== expectedState) {
    return { error: "State mismatch - please use the URL from this auth session" };
  }

  return { code };
}

export async function runAuthFlow(config: OAuthConfig): Promise<void> {
  const state = randomBytes(16).toString("hex");
  const base = getApiBase(config.sandbox);
  const redirectUri = `http://localhost:${CALLBACK_PORT}/callback`;
  const authUrl =
    `${base}/approve_app?response_type=code` +
    `&client_id=${encodeURIComponent(config.clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  return new Promise((resolve, reject) => {
    let settled = false;
    let httpServer: ReturnType<typeof createServer> | null = null;
    let rl: ReturnType<typeof createInterface> | null = null;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Authentication timed out after 120 seconds"));
    }, AUTH_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timeout);
      if (httpServer) httpServer.close();
      if (rl) rl.close();
    }

    async function handleCode(code: string) {
      if (settled) return;
      settled = true;
      try {
        const tokens = await exchangeCodeForTokens(config, code);
        saveTokens(tokens);
        cleanup();
        resolve();
      } catch (err) {
        cleanup();
        reject(err);
      }
    }

    function startStdinListener() {
      rl = createInterface({ input: process.stdin });
      rl.on("line", (line) => {
        if (settled || !line.trim()) return;
        const result = parseCallbackUrl(line, state);
        if ("error" in result) {
          // Silently ignore lines that aren't valid callback URLs
          if (line.trim().startsWith("http")) {
            console.log(`Invalid URL: ${result.error}. Try again.`);
          }
          return;
        }
        console.log("\nAuthorization code received from pasted URL!");
        handleCode(result.code);
      });
    }

    function printInstructions(serverRunning: boolean) {
      console.log("\nOpening browser for FreeAgent authorization...");
      console.log(`If the browser doesn't open, visit:\n${authUrl}\n`);

      if (serverRunning) {
        console.log(
          "Waiting for redirect... If it doesn't work, paste the full\n" +
            "redirect URL from your browser's address bar here:\n"
        );
      } else {
        console.log(
          "After approving, paste the full URL from your browser's\n" +
            "address bar here (it will start with http://localhost:...):\n"
        );
      }
    }

    // Try to start the local HTTP server
    httpServer = createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url || "/", `http://localhost:${CALLBACK_PORT}`);

        if (url.pathname !== "/callback") {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const result = parseCallbackUrl(url.toString(), state);

        if ("error" in result) {
          res.writeHead(400);
          res.end(result.error);
          if (!settled) {
            settled = true;
            cleanup();
            reject(new Error(result.error));
          }
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h1>Authentication successful!</h1>" +
            "<p>You can close this window and return to your terminal.</p>" +
            "</body></html>"
        );

        await handleCode(result.code);
      }
    );

    httpServer.on("error", () => {
      // Port is busy - fall back to paste-only flow
      httpServer = null;
      console.log(`\nPort ${CALLBACK_PORT} is busy.`);
      printInstructions(false);
      startStdinListener();
      openBrowser(authUrl);
    });

    httpServer.listen(CALLBACK_PORT, () => {
      printInstructions(true);
      startStdinListener();
      openBrowser(authUrl);
    });
  });
}
