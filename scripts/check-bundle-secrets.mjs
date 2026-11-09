// Fails if any server-only secret appears in client-side build output.
// Run after `next build` with the same environment the build used:
//   CONTENT_GITHUB_TOKEN=canary-xyz pnpm build && CONTENT_GITHUB_TOKEN=canary-xyz pnpm check:secrets
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SECRET_VARS = [
  "AUTH_SECRET",
  "AUTH_GITHUB_SECRET",
  "CONTENT_GITHUB_TOKEN",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_WEBHOOK_SECRET",
  "MEDIA_S3_SECRET_ACCESS_KEY",
  "MEDIA_S3_ACCESS_KEY_ID",
];
const secrets = SECRET_VARS.map((name) => [name, process.env[name]]).filter(([, value]) => value && value.length >= 8);
if (secrets.length === 0) {
  console.error("No secrets set in the environment; nothing to check. Set canary values for the build and this check.");
  process.exit(1);
}

const clientDir = path.resolve(".next/static");
const leaks = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else {
      const text = readFileSync(full, "latin1");
      for (const [variable, value] of secrets)
        if (text.includes(value)) leaks.push(`${variable} found in ${path.relative(".", full)}`);
    }
  }
};
walk(clientDir);
if (leaks.length) {
  console.error(`Secrets leaked into client bundles:\n${leaks.join("\n")}`);
  process.exit(1);
}
console.log(`OK: ${secrets.length} secret(s) checked; none in ${path.relative(".", clientDir)}`);
