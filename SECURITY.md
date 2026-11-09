# InkGit Security

This document describes InkGit's threat model, the controls that address each threat, and how they're verified. Report vulnerabilities privately to the repository owner rather than in public issues.

## Assets and trust boundaries

| Asset                                         | Where it lives                         | Who may change it                                      |
| --------------------------------------------- | -------------------------------------- | ------------------------------------------------------ |
| Content (articles, pages, taxonomy)           | Git content repository                 | Admins via InkGit; anyone with push access to the repo |
| Repository credential (PAT or GitHub App key) | Server environment only                | Operator                                               |
| Session cookies                               | Browser (encrypted JWT, httpOnly)      | Auth.js                                                |
| Uploaded media                                | Object storage (R2/S3) or local folder | Admins                                                 |

Readers are untrusted. Admins are trusted to write content but **not** to run code on the server or in readers' browsers. Content arriving from Git is treated as untrusted input, because the repository can be edited outside InkGit.

## Controls

| Threat                                      | Control                                                                                                                                                                                                                                                          | Verified by                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Credential leakage                          | Repo credentials are server-only (`server-only` modules, no `NEXT_PUBLIC_`), never logged or echoed in errors. GitHub App tokens are short-lived and restricted to one repo with `contents: write`.                                                              | `pnpm check:secrets` in CI (build with canary secrets, scan client bundles)     |
| Unauthorized admin access                   | GitHub OAuth plus an allowlist of **numeric** user IDs. Non-admins are refused a session at sign-in, and every admin page and server action re-checks the allowlist (`getAdmin`). `proxy.ts` is only a UX redirect.                                              | Unit tests; e2e: missing, foreign and tampered sessions; action without session |
| CSRF                                        | Server actions: Next.js origin check. Upload route handler: explicit same-origin check. Cookies are `SameSite=Lax`.                                                                                                                                              | e2e: cross-origin upload → 403                                                  |
| XSS via content                             | Safe MDX: imports/exports and `{expressions}` removed, component and HTML-tag allowlist, `script`/`iframe`/`form`/`svg`… dropped, event handlers, `style`, spreads and unsafe URL schemes stripped. `.md` raw HTML ignored. JSON-LD serialized with `<` escaped. | Unit tests (`safe-mdx`, `json-ld`); `content:check` reports removals            |
| XSS via uploads                             | Types detected by magic bytes; **SVG rejected**; content-hash file names; served with `nosniff` and `default-src 'none'`                                                                                                                                         | Unit tests; e2e: SVG and HTML-as-PNG rejected                                   |
| Privacy leaks in images                     | EXIF (incl. GPS), XMP, IPTC and comments stripped from JPEG/PNG/WebP without re-encoding                                                                                                                                                                         | Unit tests; e2e with a real JPEG carrying GPS data                              |
| Path traversal / arbitrary repo writes      | Paths built only from validated slugs, a prefix allowlist (`posts/`, `pages/`, `taxonomy.yml`) checked in every provider, symlink-escape checks for local storage, media keys must match `yyyy/mm/<hash>.<ext>`                                                  | Unit tests (`paths`, provider tests, symlink test)                              |
| Silent overwrites / lost updates            | Every write carries the expected blob SHA; GitHub ref updates are fast-forward only with per-file re-checks; overwrite requires an explicit decision                                                                                                             | Contract tests (local + fake GitHub); e2e conflict flows                        |
| Webhook spoofing                            | HMAC-SHA256 with constant-time comparison, 5 MB limit, repo/branch/path filtering; a valid webhook can only trigger a cache refresh                                                                                                                              | Unit tests; e2e: bad signature → 401                                            |
| Host-header SSRF / cache poisoning          | `proxy.ts` fetches the redirect map only from the configured `SITE_URL`, never from the request `Host`, and validates every entry                                                                                                                                | Code review (fixed in Phase 5)                                                  |
| Clickjacking, MIME sniffing, referrer leaks | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `strict-origin-when-cross-origin`, restrictive `Permissions-Policy`, HSTS                                                                                                                          | e2e header assertions                                                           |
| Abuse of uploads                            | Size limit before and after parsing, 30 uploads/min per admin                                                                                                                                                                                                    | Unit tests (size limits)                                                        |
| Vulnerable dependencies                     | Small dependency set, lockfile, `pnpm audit --prod` in CI, Dependabot                                                                                                                                                                                            | CI                                                                              |

## Content Security Policy

```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:; media-src 'self' https:; font-src 'self'; connect-src 'self';
object-src 'none'; base-uri 'self'; form-action 'self' https://github.com; frame-ancestors 'none';
frame-src 'none'; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests
```

**Trade-off:** `script-src 'unsafe-inline'` is required because Next.js inlines its RSC payload scripts. Per-request nonces would remove it, but they force every page to render dynamically and give up static output, which is the core performance property of a blog. The safe-MDX sanitizer is therefore the primary XSS defence, and the CSP is defence in depth (no plugins, no framing, no `<base>` hijacking, constrained `connect-src` and `form-action`). The e2e suite asserts the policy blocks nothing the site uses.

## Accepted risks and follow-ups

- **Rate limiting is per process** (in-memory). This is adequate for a single admin; use a shared store if the admin is exposed to many users.
- **Admins can publish any allowed HTML/Markdown**, including links to external sites and remote images. This is by design.
- **Regex-based text statistics** have super-linear worst cases on adversarial input. Only admins and repository writers control that input, and bodies are capped at ~1 MB.
- **AVIF metadata** isn't stripped.
- **Unknown public URLs** return the 404 page with HTTP 200 plus `noindex`, because of streaming.
