"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Light/Dark toggle. Guards against hydration mismatch by only reflecting
 *  the resolved theme after mount (server has no theme). */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // next-themes needs a post-mount read: the server has no theme, so we only
  // reflect the resolved theme once mounted to avoid a hydration mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle dark mode"
    >
      {isDark ? (
        <>
          <Sun className="size-4" /> Light mode
        </>
      ) : (
        <>
          <Moon className="size-4" /> Dark mode
        </>
      )}
    </Button>
  );
}
