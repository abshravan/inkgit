# InkGit

A Git-native blogging platform. **Your content belongs to you. Your repository is your CMS. Your website is your presentation layer.**

- Architecture and decisions: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Progress: [`TODO.md`](./TODO.md)

## Status

Phase 1 (foundation and public site over local content) is complete. The admin dashboard (Phase 2) and GitHub integration (Phase 3) are next.

## Getting started

Requires Node.js ≥ 20.9 and pnpm.

```bash
pnpm install
```

```bash
cp .env.example .env.local
```

```bash
pnpm dev
```

Open http://localhost:3000.

## Scripts

| Command                     | What it does                       |
| --------------------------- | ---------------------------------- |
| `pnpm dev`                  | Development server                 |
| `pnpm build` / `pnpm start` | Production build / server          |
| `pnpm typecheck`            | Generate route types and run `tsc` |
| `pnpm lint`                 | ESLint                             |
| `pnpm test`                 | Unit tests (Vitest)                |
| `pnpm format`               | Prettier                           |
| `pnpm check`                | typecheck + lint + test            |

## Writing content

Content lives in `content/` (mirroring the future content repository):

```
content/
├─ posts/<slug>.mdx     # articles (.md or .mdx); filename is the slug
├─ pages/about.mdx      # standalone pages
└─ taxonomy.yml         # curated categories
```

Frontmatter:

```yaml
---
title: "Understanding Large Language Models"
slug: "understanding-large-language-models" # optional; must match the filename
description: "An introduction to LLMs."
date: "2026-11-09"
updatedAt: "2026-11-09" # optional
author: "Admin" # optional, defaults to site config
tags: [AI, LLM]
categories: [Artificial Intelligence] # must exist in taxonomy.yml
coverImage: "/images/llm.png" # optional; site-relative or https
coverAlt: "Diagram of a transformer" # optional, recommended
published: true # defaults to false (draft)
featured: false
---
```

Invalid files are skipped and reported in the server logs. They never break the site.

### MDX

MDX runs in **safe mode**: `import`/`export` and `{expressions}` are removed, and only allowlisted components are available:

```mdx
<Callout type="tip" title="Optional title">
  Types: `info` (default), `tip`, `warning`.
</Callout>
```

Code fences support titles and line highlights:

````md
```ts title="example.ts" {2}
const a = 1;
const b = 2; // highlighted
```
````
