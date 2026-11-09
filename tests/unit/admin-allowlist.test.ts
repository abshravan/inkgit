import { describe, expect, it } from "vitest";
import { isAllowedAdmin, parseAdminIds } from "@/modules/auth/admin-allowlist";

describe("admin allowlist", () => {
  it("parses comma-separated numeric IDs", () => {
    expect([...parseAdminIds(" 123, 456 ,,")]).toEqual(["123", "456"]);
    expect(parseAdminIds(undefined).size).toBe(0);
  });

  it("rejects usernames so a renamed account can't be impersonated", () => {
    expect(() => parseAdminIds("octocat")).toThrow(/numeric/);
  });

  it("only admits listed IDs", () => {
    const allow = parseAdminIds("123");
    expect(isAllowedAdmin("123", allow)).toBe(true);
    expect(isAllowedAdmin("1234", allow)).toBe(false);
    expect(isAllowedAdmin("", allow)).toBe(false);
    expect(isAllowedAdmin(undefined, allow)).toBe(false);
  });
});
