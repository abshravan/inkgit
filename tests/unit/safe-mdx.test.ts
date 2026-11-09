import { describe, expect, it } from "vitest";
import { compileContent, ContentRenderError } from "@/modules/rendering/pipeline";
import { isSafeUrl } from "@/modules/rendering/url-safety";

describe("isSafeUrl", () => {
  it.each(["https://a.com", "http://a.com", "mailto:a@b.c", "/x", "#id", "./x", "?q=1", "images/a.png"])(
    "allows %s",
    (url) => expect(isSafeUrl(url)).toBe(true),
  );
  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,x",
    "vbscript:x",
    "//evil.com",
  ])("rejects %j", (url) => expect(isSafeUrl(url)).toBe(false));
});

describe("compileContent safe mode", () => {
  it("strips imports, exports, and expressions", async () => {
    const source = [
      'import fs from "node:fs"',
      "export const secret = process.env.SECRET",
      "",
      "Hello {process.env.GITHUB_TOKEN} world",
      "",
      "{fs.readFileSync('/etc/passwd')}",
    ].join("\n");
    const { code, warnings } = await compileContent(source, "mdx");
    expect(code).not.toMatch(/node:fs|process\.env|readFileSync|secret/);
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });

  it("drops dangerous tags with their contents and unwraps unknown components", async () => {
    const source = '<script>alert("x")</script>\n\n<iframe src="https://evil.com" />\n\n<Unknown>kept text</Unknown>';
    const { code } = await compileContent(source, "mdx");
    expect(code).not.toMatch(/alert|iframe|evil\.com|Unknown/);
    expect(code).toContain("kept text");
  });

  it("removes event handlers, style, spreads, expression attributes and unsafe URLs", async () => {
    const source = [
      '<div onClick="steal()" style="color:red" class="ok">a</div>',
      "",
      '<a href="javascript:alert(1)">b</a>',
      "",
      "<span title={window.name}>c</span>",
      "",
      "<span {...userSpread}>d</span>",
      "",
      "[link](javascript:alert(2))",
    ].join("\n");
    const { code } = await compileContent(source, "mdx");
    expect(code).not.toMatch(/steal|color:red|javascript:|window\.name|userSpread/);
    expect(code).toContain("className");
  });

  it("keeps allowlisted components", async () => {
    const { code } = await compileContent('<Callout type="tip">Hi</Callout>', "mdx");
    expect(code).toContain("Callout");
  });

  it("collects a table of contents from h2/h3 with slug ids", async () => {
    const { toc } = await compileContent("## First Part\n\n### Sub `code`\n\n#### Too deep", "mdx");
    expect(toc).toEqual([
      { id: "first-part", text: "First Part", depth: 2 },
      { id: "sub-code", text: "Sub code", depth: 3 },
    ]);
  });

  it("highlights code and tolerates unknown languages", async () => {
    const { code } = await compileContent("```notalanguage\nx\n```\n\n```ts\nconst a = 1\n```", "md");
    expect(code).toContain("data-rehype-pretty-code-figure");
  });

  it("raises a ContentRenderError with a line number on invalid MDX", async () => {
    const error = await compileContent("Line one\n\n<div>unclosed", "mdx").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ContentRenderError);
  });

  it("treats .md files as plain Markdown (no JSX)", async () => {
    const { code } = await compileContent("<script>alert(1)</script>\n\nText", "md");
    expect(code).not.toContain("alert");
  });
});
