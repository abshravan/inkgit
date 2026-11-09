# InkGit — TODO

Legend: `[ ]` todo · `[~]` in progress · `[x]` done (functionality verified, not just UI)

## Phase 0 — Planning

- [x] Architecture proposal (`ARCHITECTURE.md`)
- [x] Resolve open questions — defaults approved (ARCHITECTURE.md §12)
- [x] Approval to start Phase 1

## Phase 1 — Project Foundation ✅

- [x] Initialize Next.js 16 (App Router, Cache Components), TypeScript strict (+ `noUncheckedIndexedAccess`), pnpm
- [x] Tailwind CSS v4 + shadcn/ui (vendored, see note) + Lucide + next-themes
- [x] ESLint, Prettier, Vitest, CI workflow (typecheck, lint, format, test, build)
- [x] Zod-validated env (`src/lib/env.ts`) + `.env.example`
- [x] Content schema (Zod) + parser (gray-matter) + slug utils — with unit tests
- [x] `GitReader` interface + `LocalFsProvider` (path guard, symlink-escape check, git blob SHAs)
- [x] `ContentService` (index, drafts filtered, tags, curated categories, malformed-file isolation)
- [x] Rendering pipeline: safe MDX, GFM, Shiki dual themes, heading anchors, TOC, reading time
- [x] MDX component allowlist (`Callout`, code blocks with copy, safe HTML subset)
- [x] Public layout: header, footer (socials), theme toggle, skip link
- [x] Pages: home (hero, about, featured, recent, taxonomy), blog list, article, tags, tag, categories, category, about, 404
- [x] Article UX: reading progress, TOC (sticky desktop / collapsible mobile), copy code, reading time, share links, related
- [x] Sample content (incl. a draft) + malformed fixtures
- [x] Verified: build, 93 unit tests, Lighthouse a11y/best-practices/SEO 100

### Phase 1 follow-ups (non-blocking)

- [ ] Article page Lighthouse performance is 93–94 locally (simulated mobile; LCP render delay). Re-measure on Vercel in Phase 5.
- [ ] Unknown slugs render the 404 page with `noindex` but HTTP 200 (streaming). `proxy.ts` now has a content lookup (redirects); a hard 404 could reuse it.
- [ ] `pnpm content:check` CLI to validate a content folder/repo (needed by the content-repo CI in Phase 3).
- [ ] When the network allows `ui.shadcn.com`, re-sync vendored shadcn components with `shadcn add --overwrite`.

## Phase 2 — Content Management ✅

- [x] Auth.js GitHub OAuth + admin allowlist (numeric IDs) + per-request `getAdmin`/`requireAdmin*` guards + `proxy.ts` gate
- [x] Admin shell (sidebar, user menu, theme) + overview with stats and content-health panel
- [x] Article table (search, status filter incl. "needs attention", category filter)
- [x] CodeMirror 6 editor + toolbar + shortcuts (commands unit-tested)
- [x] Live preview (server-rendered, debounced) + full-page preview route (drafts included)
- [x] Word count, reading time, frontmatter form with field-level validation errors
- [x] IndexedDB autosave + restore + `beforeunload` guard
- [x] `GitWriter` + conditional commits; draft save / publish / unpublish / delete (LocalFsProvider)
- [x] Conflict detection and explicit-overwrite flow
- [x] Verified: 119 unit tests, 22-check Playwright smoke run

### Phase 2 follow-ups (non-blocking)

- [ ] First public request after publish may be stale (see ARCHITECTURE.md known limitations) — re-check on Vercel.
- [ ] Taxonomy management UI (edit `taxonomy.yml`) — moved to Phase 3 with other multi-file commits.
- [ ] Convert the Playwright smoke run into a committed `@playwright/test` suite (Phase 5).

## Phase 3 — Git Integration ✅

- [x] `GitHubProvider` (tree read, atomic multi-file commit, history, file-at-commit, branch creation)
- [x] Path guard + tests (traversal, prefix allowlist) — Phase 1
- [x] Optimistic concurrency on GitHub (per-file SHA checks + fast-forward-only ref update with retry)
- [x] Publishing workflow end-to-end through GitHub commits (author = signed-in admin)
- [x] Webhook endpoint (HMAC, ping, repo/branch/path filtering) + `revalidateTag("content", { expire: 0 })`
- [x] History viewer + diff + restore (as a new commit)
- [x] Rename with `redirectFrom` → HTTP 308 via `proxy.ts`
- [x] Conflict diff view
- [x] Taxonomy management (categories in `taxonomy.yml`, tag rename/merge/delete) in single commits
- [x] Contract tests (both providers) + fake GitHub API (in-process and HTTP)
- [x] Verified: 171 unit tests, 23-check e2e on the GitHub source + 22-check e2e on the local source

### Phase 3 follow-ups

- [ ] **Live verification against a real GitHub repository** (needs a content repo + fine-grained token).
- [ ] GitHub App authentication (installation tokens) instead of a PAT — Phase 5.
- [ ] `pnpm content:check` + reusable GitHub Action for the content repository (validate frontmatter/MDX on PRs).
- [ ] Preserve YAML comments in `taxonomy.yml` when editing.

## Phase 4 — Advanced Features

- [ ] Search · RSS · sitemap · robots · OG images · JSON-LD
- [ ] Media upload + library (validation, R2 storage adapter)
- [ ] Scheduled publishing · analytics
- [x] Related articles (basic, category/tag overlap) — done in Phase 1

## Phase 5 — Production Readiness

- [ ] Security review · CSP · rate limiting
- [ ] Playwright e2e (publish, conflict, restore)
- [ ] GitHub App credentials · deployment · docs
