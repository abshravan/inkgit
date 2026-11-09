import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { watchPage } from "./helpers";

test.describe("public site", () => {
  test("home lists published articles and hides drafts", async ({ page }) => {
    const problems = watchPage(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Notes from a Git-native blog");
    await expect(page.getByRole("link", { name: "Understanding Large Language Models" }).first()).toBeVisible();
    await expect(page.getByText("Notes on Writing a CLI in Rust")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "RSS" })).toHaveAttribute("href", "/rss.xml");
    expect(problems).toEqual([]);
  });

  test("article page renders code, TOC, progress, copy and JSON-LD", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const problems = watchPage(page);
    await page.goto("/blog/understanding-large-language-models");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Understanding Large Language Models");
    await expect(page.getByRole("navigation", { name: "Table of contents" })).toContainText("Tokens, not words");
    await expect(page.locator("figure[data-rehype-pretty-code-figure]")).toHaveCount(1);
    await expect(page.getByRole("progressbar", { name: "Reading progress" })).toBeAttached();
    await page.locator("figure[data-rehype-pretty-code-figure]").hover();
    await page.getByRole("button", { name: "Copy code" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("def attention(q, k, v):");
    const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
    expect(jsonLd).toMatchObject({ "@type": "BlogPosting", headline: "Understanding Large Language Models" });
    expect(problems).toEqual([]);
  });

  test("unknown articles show a noindex 404 page", async ({ page }) => {
    await page.goto("/blog/does-not-exist");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("security headers are present and the CSP blocks nothing the site needs", async ({ page }) => {
    const problems = watchPage(page);
    const response = await page.goto("/");
    const headers = response!.headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
    for (const path of ["/blog/git-is-the-best-cms", "/search?q=git", "/tags", "/categories", "/about"])
      await page.goto(path);
    await page.getByRole("button", { name: "Change theme" }).click();
    await page.getByRole("menuitemradio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(problems).toEqual([]);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`key pages have no serious accessibility violations (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      for (const path of [
        "/",
        "/blog/understanding-large-language-models",
        "/blog/typescript-patterns-for-safer-code",
        "/search?q=typescript",
      ]) {
        await page.goto(path);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
        const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(
          serious.map(
            (v) =>
              `${path}: ${v.id} → ${v.nodes.map((n) => `${n.target.join(" ")} [${n.any[0]?.message ?? ""}]`).join(" | ")}`,
          ),
        ).toEqual([]);
      }
    });
  }

  test("search ranks, tolerates typos and excludes drafts", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Search" }).click();
    await page.getByLabel("Search articles").fill("typescript");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("link", { name: "TypeScript Patterns for Safer Code" })).toBeVisible();
    await page.goto("/search?q=transfromers");
    await expect(page.getByRole("link", { name: "Understanding Large Language Models" })).toBeVisible();
    await page.goto("/search?q=cli");
    await expect(page.getByText("No matches")).toBeVisible();
  });

  test("feeds, sitemap, robots and social cards", async ({ page, request }) => {
    const rss = await request.get("/rss.xml");
    expect(rss.headers()["content-type"]).toContain("application/rss+xml");
    const parsed = await page.evaluate(
      (xml) => {
        const doc = new DOMParser().parseFromString(xml, "application/xml");
        return { error: Boolean(doc.querySelector("parsererror")), items: doc.querySelectorAll("item").length };
      },
      await rss.text(),
    );
    expect(parsed).toEqual({ error: false, items: 3 });

    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/blog/git-is-the-best-cms");
    expect(sitemap).not.toContain("writing-a-cli-in-rust");
    expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /admin");

    const card = await request.get("/og/blog/git-is-the-best-cms");
    const png = await card.body();
    expect(card.headers()["content-type"]).toBe("image/png");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });

  test("mobile layout has no horizontal overflow", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      baseURL: "http://localhost:3100",
    });
    const page = await context.newPage();
    for (const path of ["/", "/blog/typescript-patterns-for-safer-code"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(
        0,
      );
    }
    await context.close();
  });
});
