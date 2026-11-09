# Deploying InkGit

InkGit is a single Next.js app. These steps use **Vercel** (recommended). Any Node.js host works too; see the end of this guide.

## 1. Content repository

1. Create a **private** repository (for example `you/blog-content`) and copy this repo's `content/` folder into it, at the root or in a subfolder.
2. Add [`docs/content-repo-workflow.yml`](./content-repo-workflow.yml) as `.github/workflows/validate-content.yml`, so direct edits and pull requests are validated.

## 2. Repository access, choose one

**GitHub App (recommended).** Short-lived tokens limited to one repository.

1. Create an app at https://github.com/settings/apps/new:
   - Webhook: inactive.
   - Repository permissions: **Contents → Read and write**.
2. Install it on the content repository only. The installation ID is the number in the installation page URL.
3. Generate a private key.
4. Set `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID` and `GITHUB_APP_PRIVATE_KEY`. A PEM with `\n` escapes is accepted.

**Fine-grained personal access token.** Simpler.

1. Create one at https://github.com/settings/personal-access-tokens:
   - Repository access: only the content repository.
   - Permissions: **Contents → Read and write**.
2. Set it as `CONTENT_GITHUB_TOKEN`.

## 3. Sign-in

1. Create a GitHub OAuth App at https://github.com/settings/developers with:
   - Homepage URL: `https://<your domain>`
   - Callback URL: `https://<your domain>/api/auth/callback/github`
2. Set `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`.
3. Set `AUTH_SECRET` (`openssl rand -base64 32`) and `AUTH_URL=https://<your domain>`.
4. Set `ADMIN_GITHUB_IDS` to your numeric GitHub ID (the `id` field of `https://api.github.com/users/<login>`).

## 4. Media storage (Cloudflare R2)

1. Create an R2 bucket and a public custom domain (or enable the r2.dev URL).
2. Create an R2 API token with **Object Read & Write** on that bucket.
3. Set:
   - `MEDIA_STORAGE=s3`
   - `MEDIA_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`
   - `MEDIA_S3_BUCKET`
   - `MEDIA_S3_ACCESS_KEY_ID`
   - `MEDIA_S3_SECRET_ACCESS_KEY`
   - `MEDIA_PUBLIC_URL=https://<media domain>`

## 5. Vercel project

1. Import the InkGit app repository in Vercel. The framework preset (Next.js) and the default build command `next build` work as-is.
2. Add the environment variables from steps 2–4, plus:

   | Variable                       | Value                                                     |
   | ------------------------------ | --------------------------------------------------------- |
   | `CONTENT_SOURCE`               | `github`                                                  |
   | `CONTENT_REPO`                 | `you/blog-content`                                        |
   | `CONTENT_BRANCH`               | `main`                                                    |
   | `CONTENT_REPO_PATH`            | folder inside the repo (`content`, or empty for the root) |
   | `NEXT_PUBLIC_SITE_URL`         | `https://<your domain>` (needed at **build** time)        |
   | `SITE_URL`                     | `https://<your domain>`                                   |
   | `GITHUB_WEBHOOK_SECRET`        | random string                                             |
   | `NEXT_PUBLIC_ANALYTICS_DOMAIN` | optional                                                  |

   Mark every secret as **Sensitive**. Don't use the local content or media sources on Vercel: its filesystem is read-only and ephemeral, and InkGit logs a warning if you do.

3. Deploy.

## 6. Webhook

On the content repository, go to Settings → Webhooks → Add webhook:

- **Payload URL:** `https://<your domain>/api/webhooks/github`
- **Content type:** `application/json`
- **Secret:** the same value as `GITHUB_WEBHOOK_SECRET`
- **Events:** just the push event

GitHub sends a `ping` when you save the webhook; it should succeed (200).

## 7. Post-deploy checks

- [ ] `/` and an article page render, and response headers include `Content-Security-Policy`.
- [ ] `/admin` redirects to sign-in. Signing in with an account _not_ in `ADMIN_GITHUB_IDS` is refused.
- [ ] Edit an article and publish. One commit appears in the content repository with you as author, and the page updates (the first request after publishing may still be the cached version).
- [ ] Edit a file on github.com. The webhook delivery shows `revalidated: true` and the site updates.
- [ ] Upload an image and check it's served from `MEDIA_PUBLIC_URL`.
- [ ] `/rss.xml`, `/sitemap.xml` and `/robots.txt` use your domain.
- [ ] Run Lighthouse on the home and article pages.

## Other hosts

Run `pnpm build && pnpm start` behind HTTPS on Node.js ≥ 20.9. On a single persistent server, the local media source (`MEDIA_STORAGE=local`, `MEDIA_DIR` on a persistent volume) is supported. Caches and rate limits are per process, so with several instances, use a shared Next.js cache handler.
