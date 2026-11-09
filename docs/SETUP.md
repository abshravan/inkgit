# Setting up InkGit — step by step

This guide takes you from nothing to a live blog where every article is a Git commit. Work through the parts in order; each one ends with a quick check so you know it worked before moving on.

| Part                                                                | What you get                                  | Time    |
| ------------------------------------------------------------------- | --------------------------------------------- | ------- |
| [1. Run it on your computer](#part-1--run-it-on-your-computer)      | The blog running locally with sample articles | ~10 min |
| [2. Turn on the admin](#part-2--turn-on-the-admin-dashboard)        | Sign in with GitHub and write/publish locally | ~10 min |
| [3. Store content on GitHub](#part-3--store-your-content-on-github) | Every save becomes a commit in your own repo  | ~15 min |
| [4. Image uploads](#part-4--image-uploads-cloudflare-r2)            | Uploads stored on Cloudflare R2               | ~10 min |
| [5. Go live on Vercel](#part-5--go-live-on-vercel)                  | Your blog on the internet                     | ~15 min |
| [6. Finishing touches](#part-6--finishing-touches)                  | Webhook, content checks, branding, analytics  | ~10 min |

> **Two repositories, two roles.** InkGit uses:
>
> - **App repository** (`abshravan/inkgit`): the code. You rarely change it.
> - **Content repository** (e.g. `you/blog-content`, created in Part 3): your articles. InkGit commits to it every time you save.

---

## Part 0 — What you need

- A **GitHub account**.
- **Node.js 22** (20.9 or newer works). Check with:

  ```bash
  node -v
  ```

- **pnpm**. The easiest way is through Corepack, which ships with Node:

  ```bash
  corepack enable
  ```

- **Git**.
- For going live: a free **Vercel** account and, for image uploads, a free **Cloudflare** account.

---

## Part 1 — Run it on your computer

**1.1 Get the code**

```bash
git clone https://github.com/abshravan/inkgit.git
```

```bash
cd inkgit
```

The finished work currently lives on the branch `claude/stoic-galileo-m74qj5`. If it hasn't been merged into `main` yet, switch to it:

```bash
git checkout claude/stoic-galileo-m74qj5
```

> Before deploying (Part 5) you'll want this merged into `main`, because Vercel deploys `main` by default.

**1.2 Install dependencies**

```bash
pnpm install
```

**1.3 Create your settings file**

```bash
cp .env.example .env.local
```

`.env.local` holds your settings and secrets. It's git-ignored, so it's never committed. The defaults read articles from the local `content/` folder, which is all you need for now.

**1.4 Start the dev server**

```bash
pnpm dev
```

Open http://localhost:3000.

✅ **Check:** you see the homepage with three sample articles. Try `/blog`, an article, `/search?q=git` and the theme toggle. The draft _"Notes on Writing a CLI in Rust"_ should **not** appear anywhere; drafts stay hidden.

---

## Part 2 — Turn on the admin dashboard

The admin lives at `/admin`. Only the GitHub accounts you list can get in.

**2.1 Create a GitHub OAuth App (for local sign-in)**

1. Go to https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**.
2. Fill in:
   - **Application name:** `InkGit (local)`
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
3. Click **Register application**.
4. Copy the **Client ID**.
5. Click **Generate a new client secret** and copy the secret.

**2.2 Find your numeric GitHub user ID**

Open `https://api.github.com/users/<your-username>` in a browser and copy the `"id"` number (e.g. `583231`).

> InkGit uses the numeric ID instead of the username because usernames can be renamed and later claimed by someone else.

**2.3 Fill in `.env.local`**

Generate a random secret for encrypting the session cookie:

```bash
openssl rand -base64 32
```

Then set these values in `.env.local`:

```dotenv
AUTH_SECRET=<the random string you just generated>
AUTH_GITHUB_ID=<Client ID from 2.1>
AUTH_GITHUB_SECRET=<Client secret from 2.1>
ADMIN_GITHUB_IDS=<your numeric id from 2.2>
```

To allow more than one admin, separate IDs with commas: `ADMIN_GITHUB_IDS=583231,991122`.

**2.4 Restart and sign in**

Stop the dev server (Ctrl+C), start it again (`pnpm dev`), then open http://localhost:3000/admin and click **Continue with GitHub**.

✅ **Check:** you land on the **Overview** page showing 3 published articles and 1 draft.

**2.5 Try the editor**

- Open **Articles** and click an article. Type on the left; the live preview updates on the right.
- Press **Ctrl/⌘ S** to save, or click **Update** / **Publish**. The file in `content/posts/` changes.
- Create a **New article**, save it as a draft, then publish it.
- Set a future **Date** and publish to **schedule** it. It stays hidden until that day.

> Right now, saves write to the `content/` folder on your computer. Part 3 switches this to commits in a GitHub repository.

---

## Part 3 — Store your content on GitHub

**3.1 Create the content repository**

1. Go to https://github.com/new.
2. Name it, e.g. `blog-content`.
3. Choose **Private**. Drafts are stored in this repo, so keep it private.
4. Create it **empty** (no README).

**3.2 Copy the sample content into it**

From the `inkgit` folder:

```bash
mkdir -p ../blog-content && cp -r content ../blog-content/
```

```bash
cd ../blog-content
```

```bash
git init -b main && git add . && git commit -m "Initial content"
```

```bash
git remote add origin https://github.com/<you>/blog-content.git
```

```bash
git push -u origin main
```

Your content repository now has a `content/` folder containing `posts/`, `pages/` and `taxonomy.yml`.

**3.3 Give InkGit access, using one of the two options**

**Option A: Fine-grained personal access token (quickest)**

1. Go to https://github.com/settings/personal-access-tokens → **Generate new token**.
2. **Repository access:** _Only select repositories_ → `blog-content`.
3. **Permissions → Repository permissions → Contents:** _Read and write_.
4. Generate the token and copy it.

**Option B: GitHub App (recommended for production)**

Tokens are short-lived and InkGit limits each one to this repository.

1. Go to https://github.com/settings/apps/new.
2. **GitHub App name:** e.g. `InkGit for <you>`.
3. **Homepage URL:** your site (or `http://localhost:3000` for now).
4. **Webhook:** untick **Active**.
5. **Repository permissions → Contents:** _Read and write_.
6. Click **Create GitHub App** and note the **App ID**.
7. **Generate a private key.** A `.pem` file downloads.
8. Go to **Install App**, install it on your account, and choose _Only select repositories_ → `blog-content`. The number at the end of the resulting page's URL is the **Installation ID**.

**3.4 Point InkGit at the repository**

Back in the `inkgit` folder, add these to `.env.local`:

```dotenv
CONTENT_SOURCE=github
CONTENT_REPO=<you>/blog-content
CONTENT_BRANCH=main
# The articles live in the content/ folder inside the repo:
CONTENT_REPO_PATH=content
```

Then add **one** of these blocks:

```dotenv
# Option A
CONTENT_GITHUB_TOKEN=<your token>
```

```dotenv
# Option B
GITHUB_APP_ID=<App ID>
GITHUB_APP_INSTALLATION_ID=<Installation ID>
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"
```

For the private key, either paste the `.pem` contents with each line break written as `\n` (as shown), or paste it across multiple lines inside double quotes.

**3.5 Restart and test**

```bash
pnpm dev
```

1. Open `/admin`. The Overview shows **Content source: `<you>/blog-content@main/content`**.
2. Edit an article and click **Update**.
3. Check your repository on GitHub: there's a new commit like `content(update): git-is-the-best-cms`, authored by you.

✅ **Also try:**

- **History**: click **History** in the editor to see every version, with a diff and a **Restore** button.
- **Conflicts**: edit the same file on github.com while it's open in InkGit, then save in InkGit. A conflict dialog with a diff appears; nothing is overwritten unless you choose to.
- **Renaming**: change an article's **Slug** and click **Rename**. The old URL redirects to the new one.
- **Categories & tags**: renaming a tag updates every article in a single commit.

---

## Part 4 — Image uploads (Cloudflare R2)

Locally, uploads go to the `media-uploads/` folder automatically, so you can skip this part until you deploy. On Vercel, uploads need object storage.

**4.1 Create a bucket**

1. In the Cloudflare dashboard, go to **R2** → **Create bucket**, e.g. `blog-media`.
2. Open the bucket → **Settings** → **Public access**. Either connect a **custom domain** (e.g. `media.yourblog.com`) or enable the **r2.dev** URL. Copy the public URL.

**4.2 Create an API token**

1. Go to **R2** → **Manage R2 API Tokens** → **Create API token**.
2. **Permissions:** _Object Read & Write_, limited to `blog-media`.
3. Copy the **Access Key ID**, the **Secret Access Key**, and your **Account ID** (shown in the R2 overview).

**4.3 Settings**

```dotenv
MEDIA_STORAGE=s3
MEDIA_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
MEDIA_S3_BUCKET=blog-media
MEDIA_S3_REGION=auto
MEDIA_S3_ACCESS_KEY_ID=<Access Key ID>
MEDIA_S3_SECRET_ACCESS_KEY=<Secret Access Key>
MEDIA_PUBLIC_URL=https://media.yourblog.com
```

✅ **Check:** in **Admin → Media**, upload a photo. It appears in the grid and its URL starts with your `MEDIA_PUBLIC_URL`. In the editor you can also paste or drag an image straight into the text.

> Uploads accept PNG, JPEG, GIF, WebP and AVIF up to 5 MB. Location (GPS) and other metadata are removed automatically.

---

## Part 5 — Go live on Vercel

**5.1 Merge the code into `main`**

Vercel deploys your production branch, usually `main`. Merge `claude/stoic-galileo-m74qj5` into `main`, either via a pull request on GitHub or locally.

**5.2 Create a production OAuth App**

OAuth Apps allow only one callback URL, so create a second one for production:

1. https://github.com/settings/developers → **New OAuth App**.
2. **Homepage URL:** `https://<your-domain>`
3. **Callback URL:** `https://<your-domain>/api/auth/callback/github`

> Don't know your domain yet? Deploy once (step 5.3), use the `https://<project>.vercel.app` URL Vercel gives you, then update the app when you add a custom domain.

**5.3 Import the project**

1. Go to https://vercel.com/new and import your **inkgit** repository. Framework preset: **Next.js**. Leave the build settings as they are.
2. Before clicking **Deploy**, open **Environment Variables** and add everything below. Tick **Sensitive** for every secret.

| Variable                                                                                                | Value                                               |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                                                                  | `https://<your-domain>`                             |
| `SITE_URL`                                                                                              | `https://<your-domain>`                             |
| `AUTH_URL`                                                                                              | `https://<your-domain>`                             |
| `AUTH_SECRET`                                                                                           | a **new** random string (`openssl rand -base64 32`) |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`                                                                 | from the production OAuth App (5.2)                 |
| `ADMIN_GITHUB_IDS`                                                                                      | your numeric GitHub ID                              |
| `CONTENT_SOURCE`                                                                                        | `github`                                            |
| `CONTENT_REPO`                                                                                          | `<you>/blog-content`                                |
| `CONTENT_BRANCH`                                                                                        | `main`                                              |
| `CONTENT_REPO_PATH`                                                                                     | `content`                                           |
| `CONTENT_GITHUB_TOKEN` **or** `GITHUB_APP_ID` + `GITHUB_APP_INSTALLATION_ID` + `GITHUB_APP_PRIVATE_KEY` | from Part 3                                         |
| `MEDIA_STORAGE` and the `MEDIA_S3_*` / `MEDIA_PUBLIC_URL` values                                        | from Part 4                                         |
| `GITHUB_WEBHOOK_SECRET`                                                                                 | another random string (used in Part 6)              |

> ⚠️ Don't use `CONTENT_SOURCE=local` or `MEDIA_STORAGE=local` on Vercel. Its filesystem is read-only, so saves and uploads would fail.

3. Click **Deploy**.

**5.4 Add your domain (optional)**

Go to **Project → Settings → Domains** and add your domain. Then update `NEXT_PUBLIC_SITE_URL`, `SITE_URL` and `AUTH_URL`, and the OAuth App URLs, to match. **Redeploy**, because `NEXT_PUBLIC_SITE_URL` is baked in at build time.

✅ **Check:**

- The homepage loads at your domain.
- `https://<your-domain>/admin` lets **you** in, and a different GitHub account is refused.
- Publishing an article creates a commit in `blog-content`.

---

## Part 6 — Finishing touches

**6.1 Webhook: show edits made directly on GitHub**

On the **content** repository, go to **Settings → Webhooks → Add webhook** and set:

- **Payload URL:** `https://<your-domain>/api/webhooks/github`
- **Content type:** `application/json`
- **Secret:** the same value as `GITHUB_WEBHOOK_SECRET`
- **Which events?** _Just the push event_

Save. GitHub sends a test "ping"; under **Recent Deliveries** it should show a green ✓.

✅ **Check:** edit an article on github.com and commit. Within a few seconds the change is on your site. The very first page load may still show the cached version; the next one is fresh.

**6.2 Validate content edited outside InkGit**

To catch mistakes made by editing files directly on GitHub:

1. Copy `docs/content-repo-workflow.yml` (from the app repo) into your **content** repo as `.github/workflows/validate-content.yml`.
2. In that file, set `repository:` to your InkGit app repository.
3. If the app repository is **private**, create a fine-grained token with _Contents: Read-only_ on the app repo, and save it in the content repo under **Settings → Secrets and variables → Actions** as `INKGIT_READ_TOKEN`.

Every push and pull request on the content repo will now run the same checks InkGit applies before publishing. You can run them locally too:

```bash
pnpm content:check ../blog-content/content
```

**6.3 Make it yours**

Edit `src/config/site.ts` in the app repo to set the blog name, tagline, description, author name and bio, and social links. Edit `content/pages/about.mdx` in the content repo (or in the admin) for the About page. Commit and push the app repo; Vercel redeploys automatically.

**6.4 Analytics (optional)**

For cookie-free [Plausible](https://plausible.io) analytics, set `NEXT_PUBLIC_ANALYTICS_DOMAIN=<your-domain>` in Vercel and redeploy. For a self-hosted Plausible-compatible service, also set `NEXT_PUBLIC_ANALYTICS_SRC`.

---

## Troubleshooting

| Symptom                                                                | Fix                                                                                                                                           |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Login page says **"Sign-in isn't configured yet"**                     | One of `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` or `ADMIN_GITHUB_IDS` is missing. Restart the server after editing `.env.local`. |
| **"This GitHub account isn't allowed"**                                | Your numeric ID isn't in `ADMIN_GITHUB_IDS`. Check it at `api.github.com/users/<you>`.                                                        |
| GitHub says **"redirect_uri is not associated with this application"** | The OAuth App's callback URL doesn't exactly match `<site>/api/auth/callback/github`, or `AUTH_URL` points elsewhere.                         |
| Server fails to start with **"Invalid server environment"**            | The message names the variable. A common cause is `CONTENT_SOURCE=github` without `CONTENT_REPO` or a token.                                  |
| **"GitHub rejected the token (401)"**                                  | The token expired or doesn't have access to the content repo. Regenerate it with _Contents: Read and write_ on that repo.                     |
| **"Not found on GitHub"**                                              | Check `CONTENT_REPO` (`owner/name`) and `CONTENT_BRANCH`, and that the token or app can see the repo.                                         |
| **"The repository tree is too large"**                                 | Set `CONTENT_REPO_PATH` to the folder holding `posts/`.                                                                                       |
| No articles appear after switching to GitHub                           | `CONTENT_REPO_PATH` must be the folder that directly contains `posts/` (e.g. `content`), or empty if `posts/` is at the repo root.            |
| A change doesn't show on the first page load                           | Expected: the first request after a change can be served from cache, and the next is fresh.                                                   |
| Image uploads fail on Vercel                                           | Set `MEDIA_STORAGE=s3` with the R2 variables (Part 4).                                                                                        |
| Webhook deliveries show **401**                                        | `GITHUB_WEBHOOK_SECRET` in Vercel doesn't match the webhook's secret.                                                                         |
| Webhook says `"revalidated": false`                                    | The push didn't touch files under `CONTENT_REPO_PATH`, or went to a different branch.                                                         |

---

## For developers

| Command                                 | What it does                                                    |
| --------------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                              | Development server                                              |
| `pnpm build && pnpm start`              | Production build and server                                     |
| `pnpm check`                            | Typecheck, lint and unit tests                                  |
| `pnpm content:check [dir] [--strict]`   | Validate a content folder                                       |
| `pnpm exec playwright install chromium` | One-time setup for the browser tests                            |
| `pnpm build && pnpm e2e`                | Playwright suite (starts its own servers and a fake GitHub API) |

Further reading: [`ARCHITECTURE.md`](../ARCHITECTURE.md) (how it's built), [`SECURITY.md`](../SECURITY.md) (security model), [`DEPLOYMENT.md`](./DEPLOYMENT.md) (deployment reference).
