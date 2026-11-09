import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type BrowserContext, type Page } from "@playwright/test";

export const cookie = (who: "admin" | "intruder") => readFileSync(`.e2e/${who}.cookie`, "utf8");

export async function signIn(context: BrowserContext, baseURL: string, who: "admin" | "intruder" = "admin") {
  await context.addCookies([
    { name: "authjs.session-token", value: cookie(who), url: baseURL, httpOnly: true, sameSite: "Lax" },
  ]);
}

export const localContentPath = (relative: string) => path.resolve(".e2e/local/content", relative);

/** Opens the editor and waits until it's hydrated (the live preview renders). */
export async function openEditor(page: Page, slug: string, previewText: string) {
  await page.goto(`/admin/articles/${slug}`);
  await expect(page.getByLabel("Live preview").getByText(previewText).first()).toBeVisible();
}

export async function typeAtEnd(page: Page, text: string) {
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.insertText(text);
}

/** Next.js keeps the previous route mounted but hidden; only match what the user sees. */
export const visibleText = (page: Page, text: string | RegExp) =>
  page.locator("span:visible, p:visible", { hasText: text }).first();

/** Polls until `predicate(html)` holds; returns the 1-based attempt or 0. */
export async function freshAfter(page: Page, url: string, predicate: (html: string) => boolean, attempts = 12) {
  for (let i = 1; i <= attempts; i++) {
    if (predicate(await (await page.request.get(url)).text())) return i;
    await page.waitForTimeout(500);
  }
  return 0;
}

/** Collects CSP violations and uncaught errors for a page. */
export function watchPage(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && /Content Security Policy|Refused to/i.test(message.text()))
      problems.push(`csp: ${message.text()}`);
  });
  return problems;
}
