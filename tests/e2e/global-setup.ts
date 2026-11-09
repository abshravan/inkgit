import { mkdirSync, writeFileSync } from "node:fs";
import { encode } from "next-auth/jwt";

/**
 * Mints Auth.js session cookies with the test secret, so admin tests don't
 * need GitHub OAuth and the app needs no test-only login path.
 */
export default async function globalSetup() {
  const secret = process.env.E2E_AUTH_SECRET!;
  mkdirSync(".e2e", { recursive: true });
  for (const [name, githubId] of [
    ["admin", "1001"],
    ["intruder", "2002"],
  ] as const) {
    const token = await encode({
      token: {
        sub: githubId,
        name: name === "admin" ? "Test Admin" : "Intruder",
        email: `${name}@example.com`,
        githubId,
        login: name,
      },
      secret,
      salt: "authjs.session-token",
      maxAge: 6 * 60 * 60,
    });
    writeFileSync(`.e2e/${name}.cookie`, token);
  }
}
