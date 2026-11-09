# InkGit — TODO

Legend: `[ ]` todo · `[~]` in progress · `[x]` done (functionality verified, not just UI)

## Phase 0 — Planning
- [x] Architecture proposal (`ARCHITECTURE.md`)
- [ ] Resolve open questions (ARCHITECTURE.md §12)
- [ ] Approval to start Phase 1

## Phase 1 — Project Foundation
- [ ] Initialize Next.js (App Router), TypeScript strict, pnpm
- [ ] Tailwind CSS + shadcn/ui + Lucide + next-themes
- [ ] ESLint, Prettier, Vitest, CI workflow (lint, typecheck, test)
- [ ] Zod-validated env (`src/lib/env.ts`) + `.env.example`
- [ ] Content schema (Zod) + parser (gray-matter) + slug utils — with unit tests
- [ ] `GitProvider` interface + `LocalFsProvider`
- [ ] `ContentService` (index, filter published, tags, categories, malformed-file isolation)
- [ ] Rendering pipeline: safe MDX, GFM, Shiki, heading anchors, TOC, reading time
- [ ] MDX component allowlist (Callout, CodeBlock w/ copy, Figure)
- [ ] Public layout: header, footer (socials), theme toggle
- [ ] Pages: home (hero, about, featured, recent, taxonomy), blog list, article, tag, category, about, 404
- [ ] Article UX: reading progress, TOC, copy code, reading time, share links, related (basic)
- [ ] Sample content + malformed fixtures

## Phase 2 — Content Management
- [ ] Auth.js GitHub OAuth + admin allowlist + `requireAdmin` guard + middleware
- [ ] Admin shell (sidebar) + overview
- [ ] Article table (search, filter by status/tag/category)
- [ ] CodeMirror 6 editor + toolbar + shortcuts
- [ ] Live preview (server pipeline, debounced) + full-page preview route
- [ ] Word count, reading time, frontmatter form with validation errors
- [ ] IndexedDB autosave + recovery
- [ ] Draft save / publish / unpublish / delete actions (LocalFsProvider)

## Phase 3 — Git Integration
- [ ] `GitHubProvider` (tree read, atomic commit, history, file-at-commit, branch)
- [ ] Path guard + tests (traversal, prefix allowlist)
- [ ] Optimistic concurrency + `ConflictError` + conflict UI
- [ ] Publishing workflow end-to-end
- [ ] Webhook endpoint (HMAC) + tag revalidation
- [ ] History viewer + diff + restore
- [ ] Rename with `redirectFrom`
- [ ] Integration tests (mocked GitHub)

## Phase 4 — Advanced Features
- [ ] Search · RSS · sitemap · robots · OG images · JSON-LD
- [ ] Media upload + library (validation, storage adapter)
- [ ] Related articles · scheduled publishing · analytics

## Phase 5 — Production Readiness
- [ ] Security review · CSP · rate limiting
- [ ] Playwright e2e (publish, conflict, restore)
- [ ] GitHub App credentials · deployment · docs
