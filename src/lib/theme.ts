/**
 * Theme handling without a library. An inline script in <head> applies the
 * saved preference before first paint (no flash); the toggle updates the same
 * storage key and the `dark` class at runtime.
 */
export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Runs synchronously in <head>. Keep it tiny, dependency-free and ES5. */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||((p!=="light")&&window.matchMedia("${DARK_QUERY}").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;

export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(preference: ThemePreference): void {
  const dark = preference === "dark" || (preference === "system" && window.matchMedia(DARK_QUERY).matches);
  const root = document.documentElement;
  // Suppress CSS transitions for the switch so colours don't animate.
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(style);
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  window.getComputedStyle(document.body).getPropertyValue("opacity"); // force reflow
  requestAnimationFrame(() => style.remove());
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage unavailable (private mode): the choice lasts for this page only.
  }
  applyTheme(preference);
}

/** Re-applies the theme when the OS setting changes while preference is "system". */
export function watchSystemTheme(getPreference: () => ThemePreference): () => void {
  const media = window.matchMedia(DARK_QUERY);
  const onChange = () => {
    if (getPreference() === "system") applyTheme("system");
  };
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
