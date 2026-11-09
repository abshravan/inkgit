import { createHmac } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { freshAfter, openEditor, signIn, typeAtEnd, visibleText } from "./helpers";

const BASE = "http://localhost:3200";
const GH = "http://127.0.0.1:4100";

const head = async (request: APIRequestContext) =>
  (await (await request.get(`${GH}/__control/head`)).json()) as {
    message: string;
    author: { name: string };
    commitCount: number;
  };
const file = async (request: APIRequestContext, path: string) =>
  (
    (await (await request.get(`${GH}/__control/file?path=${encodeURIComponent(path)}`)).json()) as {
      content: string | null;
    }
  ).content;
const push = (request: APIRequestContext, changes: Record<string, string | null>, message = "Edit on github.com") =>
  request.post(`${GH}/__control/push`, { data: { changes, message } });

function webhook(request: APIRequestContext, payload: unknown, { secret = "whsec-test", event = "push" } = {}) {
  const body = JSON.stringify(payload);
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  return request.post(`${BASE}/api/webhooks/github`, {
    data: body,
    headers: { "content-type": "application/json", "x-github-event": event, "x-hub-signature-256": signature },
  });
}

test.describe.configure({ mode: "serial" });

test.describe("GitHub content source", () => {
  test.beforeEach(async ({ context }) => signIn(context, BASE));

  test("publishing creates one commit authored by the admin", async ({ page, request }) => {
    const before = await head(request);
    await openEditor(page, "typescript-patterns-for-safer-code", "Discriminated unions for results");
    await typeAtEnd(page, "\n\nEdited through the GitHub provider.");
    await page.getByRole("button", { name: "Update" }).click();
    await expect(visibleText(page, "Published. The public site is updated.")).toBeVisible();
    const after = await head(request);
    expect(after.commitCount).toBe(before.commitCount + 1);
    expect(after.message).toMatch(/^content\(update\): typescript-patterns-for-safer-code/);
    expect(after.author.name).toBe("Test Admin");
    expect(await file(request, "content/posts/typescript-patterns-for-safer-code.mdx")).toContain(
      "Edited through the GitHub provider.",
    );
  });

  test("history shows a diff and restore adds a new commit", async ({ page, request }) => {
    await page.goto("/admin/articles/typescript-patterns-for-safer-code/history");
    const commits = page.getByRole("navigation", { name: "Commits" }).getByRole("link");
    await expect(commits).toHaveCount(2);
    await commits.filter({ hasText: "Initial commit" }).click();
    await expect(page.locator("table")).toContainText("Edited through the GitHub provider.");
    const before = await head(request);
    await page.getByRole("button", { name: "Restore this version" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Restore" }).click();
    await page.waitForURL("**/admin/articles/typescript-patterns-for-safer-code");
    const after = await head(request);
    expect(after.commitCount).toBe(before.commitCount + 1);
    expect(after.message).toMatch(/^content\(restore\)/);
    expect(await file(request, "content/posts/typescript-patterns-for-safer-code.mdx")).not.toContain("Edited through");
  });

  test("conflicts with edits on GitHub show a diff and keep their change", async ({ page, request }) => {
    await openEditor(page, "git-is-the-best-cms", "What Git gives you for free");
    const original = (await file(request, "content/posts/git-is-the-best-cms.mdx"))!;
    await push(request, {
      "content/posts/git-is-the-best-cms.mdx": original.replace("Conflicts are a feature", "Conflicts are a FEATURE"),
    });
    await typeAtEnd(page, "\n\nMy local paragraph.");
    await page.getByRole("button", { name: "Update" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Conflicts are a FEATURE");
    await expect(dialog).toContainText("My local paragraph.");
    await dialog.getByRole("button", { name: "Keep editing" }).click();
    expect(await file(request, "content/posts/git-is-the-best-cms.mdx")).toContain("Conflicts are a FEATURE");
  });

  test("signed push webhooks refresh the site; others are rejected or ignored", async ({ page, request }) => {
    expect((await webhook(request, { ref: "refs/heads/main" }, { secret: "wrong" })).status()).toBe(401);
    expect((await webhook(request, { zen: "hi" }, { event: "ping" })).status()).toBe(200);
    const path = "content/posts/understanding-large-language-models.mdx";
    await push(request, {
      [path]: (await file(request, path))!.replace(
        "Large language models (LLMs) are",
        "Large language models (LLMs), edited on GitHub, are",
      ),
    });
    const relevant = {
      ref: "refs/heads/main",
      repository: { full_name: "acme/blog-content" },
      commits: [{ modified: [path] }],
    };
    expect(await (await webhook(request, relevant)).json()).toMatchObject({ revalidated: true });
    expect(
      await freshAfter(page, "/blog/understanding-large-language-models", (html) => html.includes("edited on GitHub")),
    ).toBeGreaterThan(0);
    const unrelated = { ...relevant, commits: [{ modified: ["README.md"] }] };
    expect(await (await webhook(request, unrelated)).json()).toMatchObject({ revalidated: false });
  });

  test("renaming is atomic and the old URL redirects with 308", async ({ page, request }) => {
    await openEditor(page, "typescript-patterns-for-safer-code", "Discriminated unions for results");
    await page.getByLabel("Slug").fill("typescript-patterns");
    await page.getByRole("button", { name: "Rename" }).click();
    await page.waitForURL("**/admin/articles/typescript-patterns");
    expect((await head(request)).message).toMatch(
      /^content\(rename\): typescript-patterns \(was typescript-patterns-for-safer-code\)/,
    );
    expect(await file(request, "content/posts/typescript-patterns-for-safer-code.mdx")).toBeNull();
    await expect
      .poll(
        async () => {
          const response = await request.get("/blog/typescript-patterns-for-safer-code", { maxRedirects: 0 });
          return `${response.status()} ${response.headers()["location"] ?? ""}`;
        },
        { timeout: 20_000 },
      )
      .toMatch(/^308 .*\/blog\/typescript-patterns$/);
  });

  test("tag rename updates every article in one commit", async ({ page, request }) => {
    await page.goto("/admin/taxonomy");
    const before = await head(request);
    await page.getByRole("button", { name: "Rename Markdown" }).click();
    await page.getByLabel("Tag name").fill("MDX");
    await page.getByRole("button", { name: "Save tag" }).click();
    await expect(page.getByText(/changed in one commit/)).toBeVisible();
    const after = await head(request);
    expect(after.commitCount).toBe(before.commitCount + 1);
    expect(after.message).toMatch(/^content\(taxonomy\): rename tag markdown to MDX/);
    expect(await file(request, "content/posts/git-is-the-best-cms.mdx")).toContain('"MDX"');
  });
});
