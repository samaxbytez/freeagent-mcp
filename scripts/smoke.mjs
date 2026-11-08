// Starts the bundled build/index.js over MCP stdio, exactly as an MCP client
// does, and checks it works. Type-check and vitest run the TypeScript sources,
// so they can't see failures that only exist in the bundle (CommonJS interop,
// a dependency that breaks when bundled). Run after `npm run build`.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const SENSITIVE = [
  "freeagent_create_user",
  "freeagent_update_user",
  "freeagent_delete_user",
  "freeagent_send_invoice_email",
  "freeagent_create_bank_account",
];
const failures = [];
const check = (ok, message) => ok || failures.push(message);

const runtimeDeps = Object.keys(pkg.dependencies ?? {});
check(
  runtimeDeps.length === 0,
  `package.json has runtime dependencies (${runtimeDeps.join(", ")}); they belong in the bundle`
);

async function listTools(env) {
  const client = new Client({ name: "smoke", version: "0" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: ["build/index.js"],
      // A dummy token: listing tools makes no API calls.
      env: { PATH: process.env.PATH ?? "", FREEAGENT_ACCESS_TOKEN: "smoke-test", ...env },
      stderr: "ignore",
    })
  );
  const info = client.getServerVersion();
  const { tools } = await client.listTools();
  await client.close();
  return { info, tools };
}

const { info, tools } = await listTools({});
check(info?.version === pkg.version, `server reports version ${info?.version}, package.json says ${pkg.version}`);
check(tools.length >= 70, `only ${tools.length} tools registered`);
check(tools.every((t) => t.annotations), "a tool is missing its annotations");
for (const name of SENSITIVE) check(!tools.some((t) => t.name === name), `${name} is exposed by default`);
check(
  !("email" in (tools.find((t) => t.name === "freeagent_update_contact")?.inputSchema.properties ?? {})),
  "freeagent_update_contact accepts email by default"
);

const opted = await listTools({ FREEAGENT_ENABLE_SENSITIVE_TOOLS: "true" });
check(
  opted.tools.length === tools.length + SENSITIVE.length,
  `with sensitive tools on, expected ${tools.length + SENSITIVE.length} tools, got ${opted.tools.length}`
);

const readOnly = await listTools({ FREEAGENT_READ_ONLY: "true", FREEAGENT_ENABLE_SENSITIVE_TOOLS: "true" });
const names = (list) => list.map((t) => t.name).sort().join();
check(
  names(readOnly.tools) === names(tools.filter((t) => t.annotations?.readOnlyHint === true)),
  "read-only mode does not expose exactly the read-only tools"
);
const spelled = await listTools({ FREEAGENT_READ_ONLY: " TRUE " });
check(spelled.tools.length === readOnly.tools.length, "FREEAGENT_READ_ONLY=TRUE did not turn on read-only mode");
const unknown = spawnSync(process.execPath, ["build/index.js"], {
  env: { PATH: process.env.PATH ?? "", FREEAGENT_ACCESS_TOKEN: "smoke-test", FREEAGENT_READ_ONLY: "maybe" },
  input: "",
  timeout: 10_000,
});
check(unknown.status === 1, `an unrecognised FREEAGENT_READ_ONLY started the server (exit ${unknown.status})`);

if (failures.length) {
  console.error(`Smoke test failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`Smoke test passed: ${info.name} ${info.version}, ${tools.length} tools (${opted.tools.length} with sensitive tools on, ${readOnly.tools.length} read-only)`);
