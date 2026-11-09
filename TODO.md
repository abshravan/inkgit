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
- [ ] Unknown slugs render the 404 page with `noindex` but HTTP 200 (streaming). Consider a slug check in `proxy.ts` (Phase 3).
- [ ] `pnpm content:check` CLI to validate a content folder/repo (needed by the content-repo CI in Phase 3).
- [ ] When the network allows `ui.shadcn.com`, re-sync vendored shadcn components with `shadcn add --overwrite`.

## Phase 2 — Content Management

- [ ] Auth.js GitHub OAuth + admin allowlist (numeric IDs) + `requireAdmin` guard + `proxy.ts` gate
- [ ] Admin shell (sidebar) + overview + content-health panel (surface `ContentIndex.issues`)
- [ ] Article table (search, filter by status/tag/category)
- [ ] CodeMirror 6 editor + toolbar + shortcuts
- [ ] Live preview (server pipeline, debounced) + full-page preview route
- [ ] Word count, reading time (reuse `text-stats.ts`), frontmatter form with validation errors
- [ ] IndexedDB autosave + recovery
- [ ] `GitWriter` interface; draft save / publish / unpublish / delete actions (LocalFsProvider)

## Phase 3 — Git Integration

- [ ] `GitHubProvider` (tree read, atomic commit, history, file-at-commit, branch)
- [x] Path guard + tests (traversal, prefix allowlist) — done in Phase 1
- [ ] Optimistic concurrency + `ConflictError` + conflict UI
- [ ] Publishing workflow end-to-end
- [ ] Webhook endpoint (HMAC) + `revalidateTag("content")`
- [ ] History viewer + diff + restore
- [ ] Rename with `redirectFrom` → redirects
- [ ] Integration tests (mocked GitHub)

## Phase 4 — Advanced Features

- [ ] Search · RSS · sitemap · robots · OG images · JSON-LD
- [ ] Media upload + library (validation, R2 storage adapter)
- [ ] Scheduled publishing · analytics
- [x] Related articles (basic, category/tag overlap) — done in Phase 1

## Phase 5 — Production Readiness

- [ ] Security review · CSP · rate limiting
- [ ] Playwright e2e (publish, conflict, restore)
- [ ] GitHub App credentials · deployment · docs
