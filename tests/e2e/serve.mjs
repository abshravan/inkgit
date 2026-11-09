// Starts a production server (`next start`) for the e2e suite with isolated,
// freshly reset data. Usage: node tests/e2e/serve.mjs <local|github> <port>
import { spawn } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const [mode, port] = process.argv.slice(2);
const root = path.resolve(".e2e", mode);
rmSync(root, { recursive: true, force: true });
mkdirSync(path.join(root, "media"), { recursive: true });

const env = {
  ...process.env,
  NODE_ENV: "production",
  SITE_URL: `http://localhost:${port}`,
  AUTH_SECRET: process.env.E2E_AUTH_SECRET,
  AUTH_GITHUB_ID: "e2e-client-id",
  AUTH_GITHUB_SECRET: "e2e-client-secret",
  ADMIN_GITHUB_IDS: "1001",
  MEDIA_STORAGE: "local",
  MEDIA_DIR: path.join(root, "media"),
};
if (mode === "local") {
  cpSync(path.resolve("content"), path.join(root, "content"), { recursive: true });
  Object.assign(env, { CONTENT_SOURCE: "local", CONTENT_DIR: path.join(root, "content") });
} else {
  Object.assign(env, {
    CONTENT_SOURCE: "github",
    GITHUB_API_URL: "http://127.0.0.1:4100",
    CONTENT_REPO: "acme/blog-content",
    CONTENT_REPO_PATH: "content",
    CONTENT_GITHUB_TOKEN: "test-token",
    GITHUB_WEBHOOK_SECRET: "whsec-test",
  });
}

const child = spawn("pnpm", ["exec", "next", "start", "-p", port], { env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
