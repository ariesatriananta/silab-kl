"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = resolvedTheme === "dark"

  const handleToggle = () => {
    if (!mounted) return
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
      aria-label={mounted ? (isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap") : "Ganti tema"}
      title={mounted ? (isDark ? "Mode terang" : "Mode gelap") : "Ganti tema"}
      onClick={handleToggle}
      className="relative h-10 w-10 rounded-full border border-border/60 bg-background/90 shadow-sm transition hover:bg-muted/40"
    >
      <Sun
        className={`size-4 text-amber-500 transition-all ${mounted && isDark ? "scale-75 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"}`}
      />
      <Moon
        className={`absolute size-4 text-slate-700 transition-all dark:text-slate-200 ${mounted && isDark ? "scale-100 rotate-0 opacity-100" : "scale-75 -rotate-90 opacity-0"}`}
      />
      <span className="sr-only">
        {mounted ? (isDark ? "Ganti ke mode terang" : "Ganti ke mode gelap") : "Ganti tema"}
      </span>
    </Button>
  )
}
