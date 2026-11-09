# InkGit

A Git-native blogging platform. **Your content belongs to you. Your repository is your CMS. Your website is your presentation layer.**

- Architecture and decisions: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Progress: [`TODO.md`](./TODO.md)

## Status

- ✅ Phase 1 — public site over local content
- ✅ Phase 2 — admin dashboard, GitHub sign-in, Markdown editor, drafts and publishing
- ✅ Phase 3 — GitHub as the content store: atomic commits, conflict detection, history + diff + restore, renames with redirects, categories & tags management, push webhook
- ⏭️ Phase 4 — search, RSS, sitemap, SEO, media uploads, scheduled publishing

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

## Admin dashboard

The admin lives at `/admin` and is restricted to the GitHub accounts listed in `ADMIN_GITHUB_IDS`.

1. Create a GitHub OAuth App at https://github.com/settings/developers with the callback URL `http://localhost:3000/api/auth/callback/github`.
2. Fill in `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` and `AUTH_SECRET` (`openssl rand -base64 32`) in `.env.local`.
3. Add your numeric GitHub user ID to `ADMIN_GITHUB_IDS` (the `id` field of `https://api.github.com/users/<your-login>`). IDs are used instead of usernames because usernames can change hands.

## Storing content on GitHub

With `CONTENT_SOURCE=local` the editor writes to the `content/` folder (good for development). For production, keep content in a GitHub repository:

1. Create a **private** repository (e.g. `you/blog-content`) and copy the `content/` folder into it, at the root or in a subfolder.
2. Create a fine-grained personal access token at https://github.com/settings/personal-access-tokens:
   - Repository access: only that repository.
   - Permissions: **Contents → Read and write** (Metadata read-only is added automatically).
3. Set `CONTENT_SOURCE=github`, `CONTENT_REPO`, `CONTENT_BRANCH`, `CONTENT_REPO_PATH` (if content lives in a subfolder) and `CONTENT_GITHUB_TOKEN`.
4. Optional but recommended: add a webhook on the repository (Settings → Webhooks):
   - Payload URL: `https://<your site>/api/webhooks/github`
   - Content type: `application/json`
   - Secret: the same value as `GITHUB_WEBHOOK_SECRET`
   - Events: just the push event.

   Edits made directly on GitHub then show up on the site within seconds.

Every save is a Git commit authored by the signed-in admin, e.g. `content(publish): hello-world`. If a file changed on GitHub since you opened it, InkGit shows a diff and asks before overwriting. Version history, restore (as a new commit), renames (old URLs redirect with 308) and category/tag changes all go through the same conditional, atomic commits.

> The first time InkGit saves a hand-written file it normalizes the frontmatter (quoted strings, block lists, fixed key order), so that first diff is larger than the edit itself. Quoting is deliberate: unquoted values such as `yes` or `on` are read as booleans by YAML 1.1 parsers.

### Testing without a real repository

`tests/helpers/fake-github-server.ts` serves an in-memory GitHub API seeded from `content/`:

```bash
pnpm dlx tsx tests/helpers/fake-github-server.ts 4100
```

```bash
CONTENT_SOURCE=github GITHUB_API_URL=http://127.0.0.1:4100 CONTENT_REPO=acme/blog-content CONTENT_REPO_PATH=content CONTENT_GITHUB_TOKEN=test-token pnpm dev
```

Editor shortcuts: <kbd>Ctrl/⌘ S</kbd> save · <kbd>Ctrl/⌘ B</kbd> bold · <kbd>Ctrl/⌘ I</kbd> italic · <kbd>Ctrl/⌘ K</kbd> link · <kbd>Ctrl/⌘ E</kbd> inline code. Unsaved edits are backed up in the browser (IndexedDB) and offered for restore.

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
