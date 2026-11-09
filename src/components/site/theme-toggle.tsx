"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { readThemePreference, saveThemePreference, watchSystemTheme, type ThemePreference } from "@/lib/theme";

const isPreference = (value: string): value is ThemePreference =>
  value === "light" || value === "dark" || value === "system";

export function ThemeToggle() {
  // The icons are driven by the `dark` class (set before paint), so the server
  // and first client render match; the stored preference is only needed once
  // the menu is opened.
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => watchSystemTheme(readThemePreference), []);

  return (
    <DropdownMenu onOpenChange={(open) => open && setPreference(readThemePreference())}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Change theme">
          <Sun className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => {
            if (!isPreference(value)) return;
            setPreference(value);
            saveThemePreference(value);
          }}
        >
          <DropdownMenuRadioItem value="light">
            <Sun /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
