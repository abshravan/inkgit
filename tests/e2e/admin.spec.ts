import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { cookie, freshAfter, localContentPath, openEditor, signIn, typeAtEnd, visibleText, watchPage } from "./helpers";

const BASE = "http://localhost:3100";
const post = (slug: string) => localContentPath(`posts/${slug}.mdx`);
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

test.describe("access control", () => {
  test("redirects visitors without a session to the login page", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByText("InkGit Admin")).toBeVisible();
  });

  test("rejects signed-in GitHub users who are not on the allowlist", async ({ page, context }) => {
    await signIn(context, BASE, "intruder");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("rejects tampered session cookies", async ({ page, context }) => {
    await context.addCookies([
      { name: "authjs.session-token", value: `${cookie("admin").slice(0, -4)}AAAA`, url: BASE },
    ]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("upload endpoint requires a session and a same-origin request", async ({ request }) => {
    const multipart = { file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("x") } };
    expect((await request.post("/api/admin/media", { multipart, headers: { origin: BASE } })).status()).toBe(401);
    const cross = await request.post("/api/admin/media", {
      multipart,
      headers: { origin: "https://evil.example", cookie: `authjs.session-token=${cookie("admin")}` },
    });
    expect(cross.status()).toBe(403);
  });
});

test.describe("editing (local content)", () => {
  test.beforeEach(async ({ context }) => signIn(context, BASE));

  test("overview and article table", async ({ page }) => {
    const problems = watchPage(page);
    await page.goto("/admin");
    await expect(page.getByText("Recently updated")).toBeVisible();
    await expect(page.getByText("Local folder")).toBeVisible();
    await page.goto("/admin/articles");
    await page.getByLabel("Search articles").fill("typescript");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByLabel("Search articles").fill("");
    await page.getByRole("button", { name: "Drafts" }).click();
    await expect(page.locator("tbody")).toContainText("Notes on Writing a CLI in Rust");
    expect(problems).toEqual([]);
  });

  test("editor has no serious accessibility violations", async ({ page }) => {
    await openEditor(page, "git-is-the-best-cms", "What Git gives you for free");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });

  test("live preview, publish, and the public page updates", async ({ page }) => {
    const problems = watchPage(page);
    await openEditor(page, "git-is-the-best-cms", "What Git gives you for free");
    await typeAtEnd(page, "\n\nAppended by **e2e**.");
    await expect(page.getByLabel("Live preview").locator("strong", { hasText: "e2e" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Update" })).toBeInViewport();
    await page.getByRole("button", { name: "Update" }).click();
    await expect(visibleText(page, "Published. The public site is updated.")).toBeVisible();
    expect(readFileSync(post("git-is-the-best-cms"), "utf8")).toContain("Appended by **e2e**.");
    expect(await freshAfter(page, "/blog/git-is-the-best-cms", (html) => html.includes("Appended by"))).toBeGreaterThan(
      0,
    );
    expect(problems).toEqual([]);
  });

  test("edits made outside the editor are never overwritten silently", async ({ page }) => {
    await openEditor(page, "typescript-patterns-for-safer-code", "Discriminated unions for results");
    writeFileSync(
      post("typescript-patterns-for-safer-code"),
      `${readFileSync(post("typescript-patterns-for-safer-code"), "utf8")}\nExternal edit.\n`,
    );
    await typeAtEnd(page, "\n\nMine.");
    await page.getByRole("button", { name: "Update" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("This article changed somewhere else")).toBeVisible();
    await expect(dialog).toContainText("External edit.");
    expect(readFileSync(post("typescript-patterns-for-safer-code"), "utf8")).toContain("External edit.");
    await dialog.getByRole("button", { name: "Overwrite with my version" }).click();
    await expect(visibleText(page, "Published. The public site is updated.")).toBeVisible();
    const after = readFileSync(post("typescript-patterns-for-safer-code"), "utf8");
    expect(after).toContain("Mine.");
    expect(after).not.toContain("External edit.");
  });

  test("content that can't render is never published", async ({ page }) => {
    await openEditor(page, "understanding-large-language-models", "Tokens, not words");
    await typeAtEnd(page, "\n\n<div>unclosed");
    await page.getByRole("button", { name: "Update" }).click();
    await expect(visibleText(page, /Can't publish/)).toBeVisible();
    expect(readFileSync(post("understanding-large-language-models"), "utf8")).not.toContain("unclosed");
  });

  test("unsaved edits survive a reload", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await openEditor(page, "typescript-patterns-for-safer-code", "Branded types");
    await typeAtEnd(page, "\n\nUnsaved autosave text.");
    await expect(page.getByText(/Backed up locally/)).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(page.locator(".cm-content")).toContainText("Unsaved autosave text.");
  });

  test("create → validate → draft → publish → schedule → delete", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto("/admin/articles/new");
    await expect(page.getByLabel("Live preview")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Title").fill("E2E Test Post");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Description is required")).toBeVisible();
    expect(existsSync(post("e2e-test-post"))).toBe(false);

    await page.getByLabel("Description").fill("Created by the e2e suite.");
    await page.getByLabel("Tags").fill("Testing, E2E");
    await page.getByLabel("Engineering").check();
    await typeAtEnd(page, "## Hello\n\nThis is a **new** article.");
    await expect(page.getByLabel("Slug")).toHaveValue("e2e-test-post");
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.waitForURL("**/admin/articles/e2e-test-post");
    await expect(visibleText(page, "Draft saved.")).toBeVisible();
    expect(readFileSync(post("e2e-test-post"), "utf8")).toContain("published: false");
    expect(await (await page.request.get("/blog/e2e-test-post")).text()).toContain("Page not found");

    // After the /new → /<slug> navigation the old editor stays mounted (hidden).
    await page.getByLabel("Date").filter({ visible: true }).fill(tomorrow);
    await page.getByRole("button", { name: "Publish" }).filter({ visible: true }).click();
    await expect(visibleText(page, /Scheduled\. It goes live on/)).toBeVisible();
    expect(await freshAfter(page, "/blog/e2e-test-post", (html) => html.includes("Page not found"))).toBeGreaterThan(0);
    expect(await (await page.request.get("/rss.xml")).text()).not.toContain("e2e-test-post");

    await page.getByLabel("Date").filter({ visible: true }).fill(today);
    await page.getByRole("button", { name: "Update" }).filter({ visible: true }).click();
    await expect(visibleText(page, "Published. The public site is updated.")).toBeVisible();
    expect(await freshAfter(page, "/blog/e2e-test-post", (html) => html.includes("This is a"))).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Delete" }).filter({ visible: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await page.waitForURL("**/admin/articles");
    expect(existsSync(post("e2e-test-post"))).toBe(false);
  });

  test("losing the session mid-edit is reported and nothing is written", async ({ page, context }) => {
    await openEditor(page, "understanding-large-language-models", "Tokens, not words");
    await context.clearCookies();
    await typeAtEnd(page, " sessionless");
    await page.getByRole("button", { name: "Update" }).click();
    await expect(visibleText(page, "You must be signed in as an admin to do this.")).toBeVisible();
    expect(readFileSync(post("understanding-large-language-models"), "utf8")).not.toContain("sessionless");
  });
});

test.describe("media", () => {
  test.beforeEach(async ({ context }) => signIn(context, BASE));

  test("uploads real images, strips GPS metadata, rejects SVG and disguised files", async ({ page }, testInfo) => {
    await page.goto("/admin");
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 320, height: 180 } });
    const jpeg = await page.screenshot({ type: "jpeg", clip: { x: 0, y: 0, width: 320, height: 180 } });
    const exif = Buffer.concat([
      Buffer.from([0xff, 0xe1, 0x00, 0x1c]),
      Buffer.from("Exif\0\0GPS=51.5074,-0.1278!!", "latin1").subarray(0, 26),
    ]);
    const files = {
      png: testInfo.outputPath("diagram.png"),
      jpg: testInfo.outputPath("vacation_photo.jpg"),
      svg: testInfo.outputPath("evil.svg"),
      fake: testInfo.outputPath("fake.png"),
    };
    writeFileSync(files.png, png);
    writeFileSync(files.jpg, Buffer.concat([jpeg.subarray(0, 2), exif, jpeg.subarray(2)]));
    writeFileSync(files.svg, '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
    writeFileSync(files.fake, "<html><script>alert(1)</script></html>");

    await page.goto("/admin/media");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Upload images").setInputFiles([files.png, files.jpg]);
    await expect(page.getByText("Uploaded vacation_photo.jpg")).toBeVisible();
    await expect(page.locator("li img")).toHaveCount(2);
    const widths = await page.$$eval("li img", (imgs) =>
      Promise.all(
        (imgs as HTMLImageElement[]).map((img) =>
          img.decode().then(
            () => img.naturalWidth,
            () => 0,
          ),
        ),
      ),
    );
    expect(widths).toEqual([320, 320]);

    const jpgKey = (await page.locator("li p.font-mono").allInnerTexts()).find((key) => key.endsWith(".jpg"))!;
    const stored = await (await page.request.get(`/media/${jpgKey}`)).body();
    expect(stored.toString("latin1")).not.toContain("GPS=51.5");
    expect(readFileSync(path.resolve(".e2e/local/media", jpgKey)).equals(stored)).toBe(true);

    await page.getByLabel("Upload images").setInputFiles([files.svg, files.fake]);
    await expect(page.getByText(/fake\.png: Only PNG/)).toBeVisible();
    await expect(page.getByText(/evil\.svg: Only PNG/)).toBeVisible();
  });

  test("editor upload inserts the image and in-use media can't be deleted", async ({ page }, testInfo) => {
    const file = testInfo.outputPath("inline.png");
    await page.goto("/admin");
    writeFileSync(file, await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 200, height: 100 } }));
    await openEditor(page, "git-is-the-best-cms", "What Git gives you for free");
    await typeAtEnd(page, "\n\n");
    await page.getByLabel("Upload image").setInputFiles(file);
    await expect(visibleText(page, "Image uploaded.")).toBeVisible();
    await expect(page.locator(".cm-content")).toContainText(/!\[inline\]\(\/media\/\d{4}\/\d{2}\/[0-9a-f]{16}\.png\)/);
    await expect(page.getByLabel("Live preview").locator('img[src^="/media/"]')).toBeVisible();
    await page.getByRole("button", { name: "Update" }).click();
    await expect(visibleText(page, "Published. The public site is updated.")).toBeVisible();
    await page.goto("/admin/media");
    const card = page.locator("li", { hasText: "git-is-the-best-cms" });
    await expect(card.getByRole("button", { name: /^Delete/ })).toBeDisabled();
  });
});
