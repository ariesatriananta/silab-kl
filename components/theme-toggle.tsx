"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const handleToggle = () => {
    const nextTheme = isDark ? "light" : "dark"

    // next-themes path (normal)
    setTheme(nextTheme)

    // fallback manual apply (robust against hydration/provider race)
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", nextTheme === "dark")
      document.body.classList.toggle("dark", nextTheme === "dark")
      document.documentElement.setAttribute("data-theme", nextTheme)
      document.body.setAttribute("data-theme", nextTheme)
      try {
        window.localStorage.setItem("theme", nextTheme)
      } catch {
        // ignore storage errors
      }
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      title={isDark ? "Mode terang" : "Mode gelap"}
      onClick={handleToggle}
      className="relative h-10 w-10 rounded-full border border-border/60 bg-background/90 shadow-sm transition hover:bg-muted/40"
    >
      <Sun
        className={`size-4 text-amber-500 transition-all ${isDark ? "scale-75 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"}`}
      />
      <Moon
        className={`absolute size-4 text-slate-700 transition-all dark:text-slate-200 ${isDark ? "scale-100 rotate-0 opacity-100" : "scale-75 -rotate-90 opacity-0"}`}
      />
      <span className="sr-only">{isDark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}</span>
    </Button>
  )
}
