import { describe, expect, it } from "vitest";
import { countWords, createExcerpt, estimateReadingTime, toPlainText } from "@/modules/rendering/text-stats";

describe("text stats", () => {
  it("strips markdown syntax", () => {
    expect(toPlainText("# Title\n\nSome **bold** and [a link](https://x.y) `code`")).toBe(
      "Title Some bold and a link code",
    );
  });

  it("keeps snake_case and removes emphasis", () => {
    expect(toPlainText("use snake_case with _care_ and ~~strike~~")).toBe("use snake_case with care and strike");
  });

  it("excludes fenced code from word count", () => {
    expect(countWords("one two\n\n```js\nconst a = 1;\n```\n\nthree")).toBe(3);
  });

  it("estimates at least one minute and scales with length", () => {
    expect(estimateReadingTime("short", 200)).toBe(1);
    expect(estimateReadingTime(Array.from({ length: 1000 }, () => "word").join(" "), 200)).toBe(5);
  });

  it("creates an excerpt from the first prose paragraph", () => {
    expect(createExcerpt("# Heading\n\nFirst *para*.\n\nSecond.")).toBe("First para.");
    expect(createExcerpt("word ".repeat(100), 50).endsWith("…")).toBe(true);
  });
});
