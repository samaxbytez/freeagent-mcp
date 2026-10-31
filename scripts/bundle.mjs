// Bundles the server, the MCP SDK and zod into build/index.js, so the published
// package has no runtime dependencies: `npx freeagent-mcp-server` installs
// exactly the code that was built and tested, not whatever versions of ~60
// transitive packages resolve on the day. Also writes the bundled packages'
// licence notices next to it, as their MIT/ISC licences require.
import { build } from "esbuild";
import { chmodSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = "build/index.js";

rmSync("build", { recursive: true, force: true });

const result = await build({
  entryPoints: ["src/index.ts"],
  outfile: OUT,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  sourcemap: false,
  metafile: true,
  legalComments: "none", // collected into THIRD_PARTY_LICENSES.txt instead
  define: {
    PACKAGE_VERSION: JSON.stringify(JSON.parse(readFileSync("package.json", "utf8")).version),
  },
  // Some bundled CommonJS code calls require(); give the ESM bundle one.
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
  logLevel: "warning",
});

chmodSync(OUT, 0o755);

// Every package that ended up in the bundle, with its licence text.
const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  const match = input.match(/^(.*node_modules\/((?:@[^/]+\/)?[^/]+))\//);
  if (match) packages.set(match[2], match[1]);
}
const notices = [...packages.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, dir]) => {
    const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
    const licenceFile = readdirSync(dir).find((f) => /^(licen[cs]e|copying)/i.test(f));
    // Their licences require the notice to travel with the code: no notice, no build.
    if (!licenceFile) throw new Error(`${name}@${pkg.version} has no licence file to bundle`);
    const text = readFileSync(path.join(dir, licenceFile), "utf8").trim();
    return `${name}@${pkg.version} (${pkg.license})\n\n${text}`;
  });
writeFileSync(
  "build/THIRD_PARTY_LICENSES.txt",
  `freeagent-mcp-server bundles the following packages.\n\n${notices.join(`\n\n${"-".repeat(72)}\n\n`)}\n`
);

console.log(`bundled ${packages.size} packages into ${OUT}`);
