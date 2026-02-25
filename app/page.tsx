"use client"

import { useEffect, useState } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Eye, EyeOff, LogIn } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function LoginPage() {
  const router = useRouter()
  const { status } = useSession()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [identifier, setIdentifier] = useState("admin")
  const [password, setPassword] = useState("password")

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard")
    }
  }, [router, status])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    const result = await signIn("credentials", {
      redirect: false,
      identifier,
      password,
      callbackUrl: "/dashboard",
    })

    if (result?.error) {
      if (result.error === "TooManyAttempts") {
        setErrorMessage("Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.")
      } else {
        setErrorMessage("Login gagal. Periksa username/NIP/NIM dan password.")
      }
      setIsLoading(false)
      return
    }

    router.push(result?.url ?? "/dashboard")
    router.refresh()
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 size-96 rounded-full bg-primary/5" />
        <div className="absolute -bottom-40 -left-40 size-96 rounded-full bg-accent/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-primary/3" />
      </div>

      <Card className="relative z-10 w-full max-w-md border-border/50 bg-card/80 shadow-xl backdrop-blur-sm">
        <CardHeader className="flex flex-col items-center gap-4 pb-2 pt-8">
          <div className="flex flex-col items-center gap-3">
            <Image
              src="/images/logo.jpeg"
              alt="Logo Poltekkes Kemenkes Surabaya"
              width={180}
              height={60}
              className="h-16 w-auto object-contain"
              priority
            />
            <div className="flex flex-col items-center gap-1">
              <h1 className="text-xl font-bold tracking-tight text-foreground">SILAB-KL</h1>
              <p className="text-sm text-muted-foreground text-center text-balance">
                Sistem Informasi Laboratorium Klinik
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8 pt-4">
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="username" className="text-sm font-medium text-foreground">
                Username / NIP / NIM
              </Label>
              <Input
                id="username"
                placeholder="Masukkan username, NIP, atau NIM"
                className="h-11 bg-background"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Masukkan password"
                  className="h-11 bg-background pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="h-11 w-full font-medium"
              disabled={isLoading || status === "loading"}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Memproses...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="size-4" />
                  Masuk
                </span>
              )}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Poltekkes Kemenkes Surabaya &copy; 2026
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
