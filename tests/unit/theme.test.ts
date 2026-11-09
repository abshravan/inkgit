import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "@/lib/theme";

describe("theme init script", () => {
  const run = (stored: string | null, prefersDark: boolean) => {
    const classes = new Set<string>();
    const root = {
      classList: { toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)) },
      style: { colorScheme: "" },
    };
    const sandbox = {
      localStorage: { getItem: (key: string) => (key === THEME_STORAGE_KEY ? stored : null) },
      window: { matchMedia: () => ({ matches: prefersDark }) },
      document: { documentElement: root },
    };
    new Function("localStorage", "window", "document", THEME_INIT_SCRIPT)(
      sandbox.localStorage,
      sandbox.window,
      sandbox.document,
    );
    return { dark: classes.has("dark"), scheme: root.style.colorScheme };
  };

  it("follows the system setting by default", () => {
    expect(run(null, true)).toEqual({ dark: true, scheme: "dark" });
    expect(run(null, false)).toEqual({ dark: false, scheme: "light" });
  });

  it("honours an explicit preference over the system", () => {
    expect(run("light", true)).toEqual({ dark: false, scheme: "light" });
    expect(run("dark", false)).toEqual({ dark: true, scheme: "dark" });
  });

  it("never throws (e.g. storage blocked)", () => {
    expect(() =>
      new Function("localStorage", THEME_INIT_SCRIPT)({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).not.toThrow();
  });
});
